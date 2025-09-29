// Research agent tools

import { z } from 'zod';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { searchGoogle } from '../google-scraper/index.js';
import type {
  SearchResult,
  GoogleSearchToolResponse,
  WebFetchToolResponse,
} from './types.js';

// Tool parameter schemas
export const GoogleSearchParamsSchema = z.object({
  query: z.string().describe('Search query to execute'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum number of results to return'),
  startIndex: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('Starting index for pagination'),
});

export const WebFetchParamsSchema = z.object({
  url: z.string().url().describe('URL to fetch content from'),
  max_length: z
    .number()
    .int()
    .min(1)
    .default(5000)
    .describe('Maximum number of characters to return'),
  start_index: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Start content from this character index'),
});

export type GoogleSearchParams = z.infer<typeof GoogleSearchParamsSchema>;
export type WebFetchParams = z.infer<typeof WebFetchParamsSchema>;

// Tool functions with proper error handling
export async function executeGoogleSearch(
  params: GoogleSearchParams
): Promise<GoogleSearchToolResponse> {
  try {
    const validatedParams = GoogleSearchParamsSchema.parse(params);
    const results = await searchGoogle(validatedParams.query, {
      maxResults: validatedParams.maxResults,
      startIndex: validatedParams.startIndex,
    });
    return { success: true, data: results };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown search error',
    };
  }
}

export async function executeWebFetch(
  params: WebFetchParams
): Promise<WebFetchToolResponse> {
  const validatedParams = WebFetchParamsSchema.parse(params);

  // Fetch the content
  const response = await fetch(validatedParams.url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    console.log(`[Web Fetch Error] ${response.status} ${params.url}`);
    return {
      success: false,
      error: `Failed to fetch URL: ${response.status} ${params.url}`,
    };
  }

  const contentType = response.headers.get('content-type') || '';
  let content = await response.text();

  // Convert HTML to markdown if content is HTML
  if (contentType.includes('text/html')) {
    const nhm = new NodeHtmlMarkdown({
      maxConsecutiveNewlines: 2,
      useInlineLinks: true,
      bulletMarker: '-',
    });
    content = nhm.translate(content);
  }

  // Apply start_index and max_length
  if (validatedParams.start_index > 0) {
    content = content.substring(validatedParams.start_index);
  }
  if (content.length > validatedParams.max_length) {
    content = content.substring(0, validatedParams.max_length);
  }

  console.log(`[Web Fetch Success] ${validatedParams.url}`);
  return { success: true, data: content };
}

// Legacy tool objects for backward compatibility with ai library if needed
export const googleSearchTool = {
  description: 'Search the web',
  parameters: GoogleSearchParamsSchema,
  execute: executeGoogleSearch,
};

export const webFetchTool = {
  description: 'Fetch web pages and convert to markdown',
  parameters: WebFetchParamsSchema,
  execute: executeWebFetch,
};
