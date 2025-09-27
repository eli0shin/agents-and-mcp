// Phase 1: Initial Search & Context Building

import { generateText } from 'ai';
import { anthropicProvider } from '../../anthropic/index.js';
import { executeGoogleSearch } from '../tools.js';
import { addSearchResults, addFindings, updatePhase } from '../state.js';
import type {
  ResearchState,
  InitialSearchResult,
  Finding,
  SearchResult,
} from '../types.js';

export async function executeInitialSearch(
  query: string,
  state: ResearchState
): Promise<InitialSearchResult> {
  // 1. Generate diverse search queries
  const searchQueries = await generateInitialSearchQueries(query);

  // 2. Execute parallel searches
  const searchPromises = searchQueries.map((q) =>
    executeGoogleSearch({
      query: q,
      maxResults: 8,
      startIndex: 1,
    })
  );
  const searchResponses = await Promise.all(searchPromises);

  // Filter successful search results
  const allSearchResults: SearchResult[] = searchResponses
    .filter((response) => response.success)
    .flatMap((response) => (response.success ? response.data : []));

  // 4. Extract key information
  const initialFindings = extractInitialFindings(allSearchResults);

  // 5. Update state
  addSearchResults(state, allSearchResults);
  addFindings(state, initialFindings);
  updatePhase(state, 'searching');

  return {
    findings: initialFindings,
    sources: allSearchResults,
  };
}

async function generateInitialSearchQueries(query: string): Promise<string[]> {
  const provider = await anthropicProvider;
  const result = await generateText({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `<task>
Generate 4-6 diverse search queries for comprehensive research on: "${query}"

Create KEYWORD-BASED search queries (not full sentences) that explore different aspects and angles.
</task>

<examples>
<good_queries>
- "JavaScript async await performance"
- "React server components SSR in nextjs"
- "TypeScript generic constraints"
- "Python machine learning scikit-learn"
- "Docker container orchestration Kubernetes"
- "GraphQL vs REST API performance"
</good_queries>

<bad_queries>
- "How do I use async await in JavaScript?"
- "Show me examples of React server components"
- "Explain TypeScript generics to me"
- "What are the best Python libraries for machine learning?"
- "Can you help me understand Docker containers?"
</bad_queries>
</examples>

<requirements>
- Use 2-6 keywords per query
- Focus on technical terms, concepts, or specific implementations
- Avoid question words (how, what, why, when)
- Avoid conversational phrases
- Each query should target different important and relevant aspects of the topic
- Include relevant technologies, frameworks, or methodologies
</requirements>

Return ONLY valid JSON in this exact format (no explanations, no markdown, no XML tags):

{
  "queries": ["query1", "query2", "query3", ...]
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

function extractInitialFindings(results: SearchResult[]): Finding[] {
  return results.map((result) => ({
    id: crypto.randomUUID(),
    content: result.snippet,
    source: result.url,
    timestamp: new Date(),
  }));
}
