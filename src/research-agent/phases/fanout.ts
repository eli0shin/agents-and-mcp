// Phase 3: Fan-Out Investigation

import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { anthropicProvider } from '../../anthropic/index.js';
import { executeGoogleSearch, executeWebFetch } from '../tools.js';
import { addFindings, addWebContents, updatePhase } from '../state.js';
import type {
  ResearchState,
  ResearchPlan,
  Finding,
  InvestigationStrategy,
  WebContent,
  SearchResult,
} from '../types.js';

const relevanceSchema = z.object({
  relevant: z.boolean(),
  reason: z.string().optional(),
});

async function checkContentRelevance(
  content: string,
  originalQuery: string,
  researchQuestion: string,
  searchQuery: string
): Promise<{ relevant: boolean; reason?: string }> {
  const provider = await anthropicProvider;

  const { object } = await generateObject({
    model: provider('claude-sonnet-4-20250514'),
    schema: relevanceSchema,
    prompt: `Determine if this content is strictly relevant to provide an answer to the research inquiry.

<original_query>
${originalQuery}
</original_query>

<research_question>
${researchQuestion}
</research_question>

<search_query>
${searchQuery}
</search_query>

<content>
${content}
</content>

Return true only if the content contains information that could help answer the research question or original query. Be strict - marketing content, irrelevant articles, artictles about a different but similar topic, or tangential information should be marked as false.`,
  });

  return object;
}

export async function executeFanOutInvestigation(
  state: ResearchState,
  plan: ResearchPlan
): Promise<Finding[]> {
  const investigations = plan.investigationStrategies;

  // 1. Execute all investigations in parallel
  const investigationPromises = investigations.map((strategy) =>
    executeInvestigationStrategy(strategy, state.query)
  );

  // 2. Process all investigations in parallel
  const results = await Promise.all(investigationPromises);

  // 3. Update state
  const allFindings = results.flat();
  addFindings(state, allFindings);
  updatePhase(state, 'investigating');

  return allFindings;
}

async function executeInvestigationStrategy(
  strategy: InvestigationStrategy,
  originalQuery: string
): Promise<Finding[]> {
  // 1. Generate specialized search queries
  const queries = await generateSpecializedQueries(strategy);

  // 2. Execute searches in parallel
  const searchPromises = queries.map((query) =>
    executeGoogleSearch({
      query: query,
      maxResults: 6,
      startIndex: 1,
    })
  );

  const searchResponses = await Promise.all(searchPromises);

  // Filter successful search results
  const allSearchResults: SearchResult[] = searchResponses
    .filter((response) => response.success)
    .flatMap((response) => (response.success ? response.data : []));

  // 3. Fetch content from top results
  const topResults = allSearchResults.slice(0, 9);
  const contentPromises = topResults.map((item) =>
    executeWebFetch({
      url: item.url,
      max_length: 10_000,
      start_index: 0,
    })
  );

  const contentResponses = await Promise.all(contentPromises);

  // Filter successful content fetches and keep URL mapping
  const contentsWithUrls = contentResponses
    .map((response, index) => {
      const url = topResults[index]?.url;
      return {
        content: response.success ? response.data : '',
        url: url || '',
        success: response.success,
      };
    })
    .filter(
      (item) => item.success && item.content.length > 100 && item.url !== ''
    );

  const contents = contentsWithUrls.map((item) => item.content);
  const urls = contentsWithUrls.map((item) => item.url);

  // 4. Check relevance for each piece of content
  const relevancePromises = contents.map((content, index) => {
    // Map content back to the query that produced it
    const queryIndex = Math.floor((index * queries.length) / contents.length);
    const searchQuery = queries[queryIndex] || queries[0] || '';

    return checkContentRelevance(
      content,
      originalQuery,
      strategy.question,
      searchQuery
    );
  });

  const relevanceResults = await Promise.all(relevancePromises);

  // Filter to only relevant content and their corresponding URLs
  const relevantItems = contents
    .map((content, index) => ({
      content,
      url: urls[index],
      relevant: relevanceResults[index]?.relevant || false,
    }))
    .filter(
      (item): item is { content: string; url: string; relevant: boolean } =>
        item.relevant && typeof item.url === 'string' && item.url !== ''
    );

  const relevantContents = relevantItems.map((item) => item.content);
  const relevantUrls = relevantItems.map((item) => item.url);

  console.log(
    `[Relevance Filter] ${contents.length} -> ${relevantContents.length} relevant items for question: "${strategy.question}"`
  );

  // 5. Extract insights from ONLY relevant content
  const insights = await extractInsightsFromContent(
    relevantContents,
    relevantUrls,
    strategy.question
  );

  return insights;
}

async function generateSpecializedQueries(
  strategy: InvestigationStrategy
): Promise<string[]> {
  const provider = await anthropicProvider;

  const result = await generateText({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `<task>
Generate 2-3 specialized KEYWORD-BASED search queries to investigate this research question:

<question>
${strategy.question}
</question>

<approach>
${strategy.approach}
</approach>

<expected-sources>
${strategy.expectedSources.join(', ')}
</expected-sources>
</task>

<examples>
<good_specialized_queries>
- "React performance optimization techniques"
- "Node.js memory leaks debugging tools"
- "PostgreSQL indexing best practices performance"
- "Kubernetes security vulnerabilities CVE"
- "Python async concurrent programming patterns"
</good_specialized_queries>

<bad_specialized_queries>
- "How can I optimize React performance?"
- "What tools help debug Node.js memory leaks?"
- "Show me the best practices for PostgreSQL indexing"
- "Are there security issues with Kubernetes?"
- "Explain Python async programming to me"
</bad_specialized_queries>
</examples>

<requirements>
- Use 2-6 targeted keywords per query
- Focus on technical terms, methodologies, or specific tools
- Avoid question words (how, what, why, when, are, is)
- Avoid conversational phrases
- Include relevant technologies from expectedSources when applicable
- Target authoritative sources like documentation, research papers, or expert analysis
</requirements>

Return ONLY valid JSON in this exact format (no explanations, no markdown, no XML tags):

{
  "queries": ["query1", "query2", "query3"]
}`,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 16000 },
      },
    },
  });

  const parsed = JSON.parse(result.text) as { queries: string[] };
  return parsed.queries;
}

async function extractInsightsFromContent(
  contents: string[],
  urls: string[],
  question: string
): Promise<Finding[]> {
  const provider = await anthropicProvider;

  // Filter valid content upfront
  const validContents = contents.filter(
    (content) =>
      !content.startsWith('Error fetching') && content.trim().length >= 100
  );

  // Process all content in parallel to extract main content
  const contentPromises = validContents.map(async (content, index) => {
    try {
      const { text } = await generateText({
        model: provider('claude-sonnet-4-20250514'),
        prompt: `Extract the main content body from this page, removing any navigation, headers, footers, sidebars, advertisements, or other page decorations. Keep all substantive content intact - do not summarize or shorten it. Return the complete main article/page content in its entirety.

<content>
${content}
</content>

Return only the main content body, preserving all substantial information and details.`,
      });

      if (text.trim().length > 0) {
        return {
          id: crypto.randomUUID() as string,
          content: text,
          source: urls[index],
          timestamp: new Date(),
        };
      }
      return null;
    } catch (error) {
      console.warn('Failed to extract main content from page:', error);
      return null;
    }
  });

  const results = await Promise.all(contentPromises);

  // Filter out null results
  return results.filter((finding): finding is Finding => finding !== null);
}
