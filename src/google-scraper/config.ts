export function getConfig() {
  return {
    apiKey: process.env.GOOGLE_API_KEY,
    searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
    baseUrl: 'https://www.googleapis.com/customsearch/v1',
    maxResultsPerRequest: 10,
    defaultMaxResults: 20,
  } as const;
}

export function validateConfig() {
  const config = getConfig();
  
  if (!config.apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }

  if (!config.searchEngineId) {
    throw new Error('GOOGLE_SEARCH_ENGINE_ID environment variable is required');
  }
  
  return config;
}
