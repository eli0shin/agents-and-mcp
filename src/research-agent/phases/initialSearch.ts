// Phase 1: Initial Search & Context Building

import { generateObject } from 'ai';
import { z } from 'zod';
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
  const result = await generateObject({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `Generate 4-6 diverse search queries for comprehensive research on: "${query}"
    
    Create queries that explore different aspects, perspectives, and angles of the topic.
    Make them specific enough to find relevant information but broad enough to capture various viewpoints.`,
    schema: z.object({
      queries: z.array(z.string()),
    }),
  });
  return result.object.queries;
}

function extractInitialFindings(results: SearchResult[]): Finding[] {
  return results.map((result) => ({
    id: crypto.randomUUID(),
    content: result.snippet,
    source: result.url,
    timestamp: new Date(),
  }));
}
