// Phase 1: Initial Search & Context Building

import { randomUUID } from 'crypto';
import { generateText } from 'ai';
import { anthropicProvider } from '../../anthropic/index.js';
import { executeGoogleSearch } from '../tools.js';
import { addSearchResults, addFindings, updatePhase } from '../state.js';
import { persistPrompt, persistResponse } from '../sessionStorage.js';
import { buildInitialSearchQueriesPrompt } from '../prompts.js';
import type {
  ResearchState,
  InitialSearchResult,
  Finding,
  SearchResult,
} from '../types.js';

export async function executeInitialSearch(
  state: ResearchState
): Promise<InitialSearchResult> {
  // 1. Generate diverse search queries
  const searchQueries = await generateInitialSearchQueries(state);

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

async function generateInitialSearchQueries(
  state: ResearchState
): Promise<string[]> {
  const provider = await anthropicProvider;
  const prompt = buildInitialSearchQueriesPrompt(state);
  const promptId = await persistPrompt(
    state.sessionId,
    buildInitialSearchQueriesPrompt.name,
    prompt
  );

  const result = await generateText({
    model: provider('claude-sonnet-4-20250514'),
    prompt,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 16000 },
      },
    },
  });

  await persistResponse(
    state.sessionId,
    buildInitialSearchQueriesPrompt.name,
    promptId,
    result.text
  );

  const parsed = JSON.parse(result.text) as { queries: string[] };
  return parsed.queries;
}

function extractInitialFindings(results: SearchResult[]): Finding[] {
  return results.map((result) => ({
    id: randomUUID(),
    content: result.snippet,
    source: result.url,
    timestamp: new Date(),
  }));
}
