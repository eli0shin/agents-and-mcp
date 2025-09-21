import { test, expect, mock } from 'bun:test';
import { GoogleSearchClient, searchGoogle } from './index';
import type { GoogleSearchResponse, SearchError } from './types';

const mockApiKey = 'test-api-key';
const mockSearchEngineId = 'test-search-engine-id';

process.env.GOOGLE_API_KEY = mockApiKey;
process.env.GOOGLE_SEARCH_ENGINE_ID = mockSearchEngineId;

const mockSearchResponse: GoogleSearchResponse = {
  items: [
    {
      title: 'Test Result 1',
      link: 'https://example.com/1',
      snippet: 'This is the first test result snippet',
    },
    {
      title: 'Test Result 2',
      link: 'https://example.com/2',
      snippet: 'This is the second test result snippet',
    },
  ],
  searchInformation: {
    totalResults: '2',
    searchTime: 0.123456,
  },
  queries: {
    request: [
      {
        title: 'Google Custom Search - test query',
        totalResults: '2',
        searchTerms: 'test query',
        count: 2,
        startIndex: 1,
      },
    ],
  },
};

const mockErrorResponse: SearchError = {
  error: {
    code: 400,
    message: 'Invalid API key',
    errors: [
      {
        domain: 'global',
        reason: 'badRequest',
        message: 'Invalid API key',
      },
    ],
  },
};

test('GoogleSearchClient constructor validates config', () => {
  const originalApiKey = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  expect(() => new GoogleSearchClient()).toThrow(
    'GOOGLE_API_KEY environment variable is required'
  );

  process.env.GOOGLE_API_KEY = originalApiKey;
});

test('search returns formatted results', async () => {
  const mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockSearchResponse),
    })
  );

  global.fetch = mockFetch as any;

  const client = new GoogleSearchClient();
  const results = await client.search('test query');

  expect(results).toHaveLength(2);
  expect(results[0]).toEqual({
    title: 'Test Result 1',
    url: 'https://example.com/1',
    snippet: 'This is the first test result snippet',
    position: 1,
  });
  expect(results[1]).toEqual({
    title: 'Test Result 2',
    url: 'https://example.com/2',
    snippet: 'This is the second test result snippet',
    position: 2,
  });

  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('search validates options with Zod', async () => {
  const client = new GoogleSearchClient();

  await expect(client.search('test', { maxResults: -1 })).rejects.toThrow();
  await expect(client.search('test', { maxResults: 101 })).rejects.toThrow();
  await expect(client.search('test', { startIndex: 0 })).rejects.toThrow();
});

test('search handles pagination for 20 results', async () => {
  const mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          ...mockSearchResponse,
          items: Array.from({ length: 10 }, (_, i) => ({
            title: `Result ${i + 1}`,
            link: `https://example.com/${i + 1}`,
            snippet: `Snippet ${i + 1}`,
          })),
        }),
    })
  );

  global.fetch = mockFetch as any;

  const client = new GoogleSearchClient();
  const results = await client.search('test query', { maxResults: 20 });

  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(results).toHaveLength(20);
  expect(results[0]?.position).toBe(1);
  expect(results[19]?.position).toBe(20);
});

test('search handles API errors with validation', async () => {
  const mockFetch = mock(() =>
    Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve(mockErrorResponse),
    })
  );

  global.fetch = mockFetch as any;

  const client = new GoogleSearchClient();

  await expect(client.search('test query')).rejects.toThrow(
    'Search failed: API request failed (400): Invalid API key'
  );
});

test('search handles empty results', async () => {
  const mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          ...mockSearchResponse,
          items: [],
        }),
    })
  );

  global.fetch = mockFetch as any;

  const client = new GoogleSearchClient();
  const results = await client.search('no results query');

  expect(results).toHaveLength(0);
});

test('search respects maxResults option', async () => {
  const mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockSearchResponse),
    })
  );

  global.fetch = mockFetch as any;

  const client = new GoogleSearchClient();
  const results = await client.search('test query', { maxResults: 1 });

  expect(results).toHaveLength(1);
  expect(results[0]?.title).toBe('Test Result 1');
});

test('searchGoogle function works as expected', async () => {
  const mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockSearchResponse),
    })
  );

  global.fetch = mockFetch as any;

  const results = await searchGoogle('test query');

  expect(results).toHaveLength(2);
  expect(results[0]?.title).toBe('Test Result 1');
});

test('search validates API response structure', async () => {
  const invalidResponse = {
    items: [
      {
        title: 'Test',
        link: 'not-a-url', // Invalid URL
        snippet: 'Test snippet',
      },
    ],
    searchInformation: {
      totalResults: '1',
      searchTime: 0.1,
    },
    queries: {
      request: [
        {
          title: 'Test',
          totalResults: '1',
          searchTerms: 'test',
          count: 1,
          startIndex: 1,
        },
      ],
    },
  };

  const mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(invalidResponse),
    })
  );

  global.fetch = mockFetch as any;

  const client = new GoogleSearchClient();

  await expect(client.search('test query')).rejects.toThrow();
});
