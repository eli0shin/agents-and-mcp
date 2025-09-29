// Phase 3: Fan-Out Investigation

import { randomUUID } from 'crypto';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { anthropicProvider } from '../../anthropic/index.js';
import { executeGoogleSearch, executeWebFetch } from '../tools.js';
import { addFindings, addWebContents, updatePhase } from '../state.js';
import { persistPrompt, persistResponse } from '../sessionStorage.js';
import {
  buildContentExtractionPrompt,
  buildContentRelevancePrompt,
  buildSpecializedQueriesPrompt,
} from '../prompts.js';
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
  state: ResearchState,
  params: {
    content: string;
    researchQuestion: string;
    searchQuery: string;
  }
): Promise<{ relevant: boolean; reason?: string }> {
  const provider = await anthropicProvider;
  const prompt = buildContentRelevancePrompt(state, params);
  const promptId = await persistPrompt(
    state.sessionId,
    buildContentRelevancePrompt.name,
    prompt
  );

  const { object } = await generateObject({
    model: provider('claude-sonnet-4-20250514'),
    schema: relevanceSchema,
    prompt,
  });

  await persistResponse(
    state.sessionId,
    buildContentRelevancePrompt.name,
    promptId,
    JSON.stringify(object, null, 2)
  );

  return object;
}

export async function executeFanOutInvestigation(
  state: ResearchState,
  plan: ResearchPlan
): Promise<Finding[]> {
  const investigations = plan.investigationStrategies;

  // 1. Execute all investigations in parallel
  const investigationPromises = investigations.map((strategy) =>
    executeInvestigationStrategy(state, strategy)
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
  state: ResearchState,
  strategy: InvestigationStrategy
): Promise<Finding[]> {
  // 1. Generate specialized search queries
  const queries = await generateSpecializedQueries(state, strategy);

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

    return checkContentRelevance(state, {
      content,
      researchQuestion: strategy.question,
      searchQuery,
    });
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
    state,
    relevantContents,
    relevantUrls,
    strategy.question
  );

  return insights;
}

async function generateSpecializedQueries(
  state: ResearchState,
  strategy: InvestigationStrategy
): Promise<string[]> {
  const provider = await anthropicProvider;
  const prompt = buildSpecializedQueriesPrompt(strategy);
  const promptId = await persistPrompt(
    state.sessionId,
    buildSpecializedQueriesPrompt.name,
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
    buildSpecializedQueriesPrompt.name,
    promptId,
    result.text
  );

  const parsed = JSON.parse(result.text) as { queries: string[] };
  return parsed.queries;
}

async function extractInsightsFromContent(
  state: ResearchState,
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
    const prompt = buildContentExtractionPrompt(content);
    const promptId = await persistPrompt(
      state.sessionId,
      buildContentExtractionPrompt.name,
      prompt
    );

    try {
      const { text } = await generateText({
        model: provider('claude-sonnet-4-20250514'),
        prompt,
      });

      await persistResponse(
        state.sessionId,
        buildContentExtractionPrompt.name,
        promptId,
        text
      );

      if (text.trim().length > 0) {
        return {
          id: randomUUID(),
          content: text,
          source: urls[index] ?? '',
          timestamp: new Date(),
        } as Finding;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Failed to extract main content from page:', message);
      return null;
    }
  });

  const results = await Promise.all(contentPromises);

  // Filter out null results
  return results.filter((finding): finding is Finding => finding !== null);
}
