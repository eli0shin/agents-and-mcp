import { searchGoogle, GoogleSearchClient } from './index';

async function example() {
  try {
    // Simple search using the convenience function
    console.log('=== Simple Search ===');
    const results = await searchGoogle('TypeScript tutorial', {
      maxResults: 5,
    });

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Snippet: ${result.snippet}`);
      console.log('');
    });

    // Using the client class for more control
    console.log('=== Using Client Class ===');
    const client = new GoogleSearchClient();
    const moreResults = await client.search('Bun JavaScript runtime', {
      maxResults: 10,
      startIndex: 1,
    });

    console.log(`Found ${moreResults.length} results:`);
    moreResults.forEach((result) => {
      console.log(`- ${result.title} (Position: ${result.position})`);
    });
  } catch (error) {
    console.error('Search failed:', error);
  }
}

// Run example if this file is executed directly
if (import.meta.main) {
  example();
}
