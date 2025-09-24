// Phase 3: Fan-Out Investigation

import { generateText } from 'ai';
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

export async function executeFanOutInvestigation(
  state: ResearchState,
  plan: ResearchPlan
): Promise<Finding[]> {
  const investigations = plan.investigationStrategies;

  // 1. Execute all investigations in parallel
  const investigationPromises = investigations.map((strategy) =>
    executeInvestigationStrategy(strategy)
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
  strategy: InvestigationStrategy
): Promise<Finding[]> {
  // 1. Generate specialized search queries
  const queries = await generateSpecializedQueries(strategy);
  console.log('[LS] -> p/s/r/p/fanout.ts:42 -> queries: ', queries);

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
  const contentPromises = allSearchResults.slice(0, 9).map((item) =>
    executeWebFetch({
      url: item.url,
      max_length: 6000,
      start_index: 0,
    })
  );

  const contentResponses = await Promise.all(contentPromises);

  // Filter successful content fetches
  const contents = contentResponses
    .filter((response) => response.success)
    .map((response) => (response.success ? response.data : ''))
    .filter((content) => content.length > 100);

  // 4. Extract insights from content
  const insights = await extractInsightsFromContent(
    contents,
    strategy.question
  );
  console.log('[LS] -> p/s/r/p/fanout.ts:82 -> insights: ', insights);

  return insights;
}

async function generateSpecializedQueries(
  strategy: InvestigationStrategy
): Promise<string[]> {
  const provider = await anthropicProvider;

  const { text } = await generateText({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `Generate 2-3 specific search queries to investigate this research question:
"${strategy.question}"

Approach: ${strategy.approach}
Expected sources: ${strategy.expectedSources.join(', ')}

Create targeted queries that will find relevant, authoritative information.
Format as a simple list, one query per line.`,
  });

  return text.split('\n').filter((query) => query.trim().length > 0);
}

async function extractInsightsFromContent(
  contents: string[],
  question: string
): Promise<Finding[]> {
  const provider = await anthropicProvider;

  const findings: Finding[] = [];

  for (const content of contents) {
    if (content.startsWith('Error fetching') || content.trim().length < 100) {
      continue; // Skip failed fetches or very short content
    }

    try {
      const { text } = await generateText({
        model: provider('claude-sonnet-4-20250514'),
        prompt: `Extract key insights from this content that relate to the research question: "${question}"

Content:
${content}

Provide 2-3 specific, factual insights that directly address the research question.
Focus on concrete information, data, or expert opinions.
Format as bullet points.`,
      });

      if (text.trim().length > 0) {
        findings.push({
          id: crypto.randomUUID(),
          content: text,
          source: 'web_content', // We could track the actual URL if needed
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.warn('Failed to extract insights from content:', error);
      continue;
    }
  }

  return findings;
}
