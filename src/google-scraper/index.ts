import { validateConfig } from './config';
import { 
  GoogleSearchResponseSchema, 
  SearchErrorSchema,
  SearchOptionsSchema,
} from './schemas';
import type {
  SearchResult,
  GoogleSearchResponse,
  SearchOptions,
  SearchError,
  GoogleSearchItem,
} from './types';

export class GoogleSearchClient {
  private config;
  
  constructor() {
    this.config = validateConfig();
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Validate options with Zod
    const validatedOptions = SearchOptionsSchema.parse(options);
    const maxResults = Math.min(
      validatedOptions.maxResults || this.config.defaultMaxResults,
      100
    );
    const results: SearchResult[] = [];

    let startIndex = validatedOptions.startIndex || 1;
    let remainingResults = maxResults;

    while (remainingResults > 0 && startIndex <= 91) {
      const requestCount = Math.min(
        remainingResults,
        this.config.maxResultsPerRequest
      );

      try {
        const response = await this.makeRequest(
          query,
          startIndex,
          requestCount
        );

        if (!response.items || response.items.length === 0) {
          break;
        }

        const batchResults = this.transformResults(response.items, startIndex);
        results.push(...batchResults);

        remainingResults -= response.items.length;
        startIndex += this.config.maxResultsPerRequest;

        if (response.items.length < requestCount) {
          break;
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Search failed: ${error.message}`);
        }
        throw error;
      }
    }

    return results.slice(0, maxResults);
  }

  private async makeRequest(
    query: string,
    startIndex: number,
    count: number
  ): Promise<GoogleSearchResponse> {
    const url = new URL(this.config.baseUrl);
    url.searchParams.set('key', this.config.apiKey!);
    url.searchParams.set('cx', this.config.searchEngineId!);
    url.searchParams.set('q', query);
    url.searchParams.set('start', startIndex.toString());
    url.searchParams.set('num', count.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const rawErrorData = await response.json();
      const errorData = SearchErrorSchema.parse(rawErrorData);
      throw new Error(
        `API request failed (${response.status}): ${errorData.error.message}`
      );
    }

    const rawData = await response.json();
    return GoogleSearchResponseSchema.parse(rawData);
  }

  private transformResults(
    items: GoogleSearchItem[],
    startIndex: number
  ): SearchResult[] {
    return items.map((item, index) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      position: startIndex + index,
    }));
  }
}

export async function searchGoogle(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const client = new GoogleSearchClient();
  return client.search(query, options);
}

export * from './types';
export * from './config';
