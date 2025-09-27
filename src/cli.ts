#!/usr/bin/env bun
import { Command } from '@commander-js/extra-typings';
import { generateText } from 'ai';
import { searchGoogle } from './google-scraper/index';
import {
  loginCommand,
  logoutCommand,
  listCommand,
  statusCommand,
  anthropicProvider,
} from './anthropic/index.js';
import { performDeepResearch } from './research-agent/index.js';

const program = new Command()
  .name('agents-and-mcp')
  .description('CLI for agents and MCP tooling')
  .version('1.0.0');

program
  .command('search')
  .description('Search Google and return results')
  .argument('<query>', 'Search query')
  .option(
    '-n, --max-results <number>',
    'Maximum number of results to return (1-100)',
    '10'
  )
  .option('-s, --start <number>', 'Starting index for results (1-based)', '1')
  .option('-j, --json', 'Output results as JSON')
  .option('-q, --quiet', 'Only output results, no headers')
  .action(async (query, options) => {
    try {
      const maxResults = parseInt(options.maxResults);
      const startIndex = parseInt(options.start);

      if (isNaN(maxResults) || maxResults < 1 || maxResults > 100) {
        console.error('Error: max-results must be a number between 1 and 100');
        process.exit(1);
      }

      if (isNaN(startIndex) || startIndex < 1) {
        console.error('Error: start must be a number greater than 0');
        process.exit(1);
      }

      if (!options.quiet) {
        console.log(`Searching for: "${query}"`);
        console.log(`Max results: ${maxResults}, Starting at: ${startIndex}`);
        console.log('');
      }

      const results = await searchGoogle(query, {
        maxResults,
        startIndex,
      });

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        if (results.length === 0) {
          console.log('No results found.');
        } else {
          results.forEach((result, index) => {
            console.log(`${result.position}. ${result.title}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   ${result.snippet}`);
            console.log('');
          });

          if (!options.quiet) {
            console.log(
              `Found ${results.length} result${results.length === 1 ? '' : 's'}.`
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unexpected error occurred');
      }
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show configuration status')
  .action(() => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    console.log('Configuration Status:');
    console.log(`API Key: ${apiKey ? '✓ Set' : '✗ Missing'}`);
    console.log(`Search Engine ID: ${searchEngineId ? '✓ Set' : '✗ Missing'}`);

    if (!apiKey || !searchEngineId) {
      console.log('');
      console.log('To configure:');
      console.log('1. Set GOOGLE_API_KEY environment variable');
      console.log('2. Set GOOGLE_SEARCH_ENGINE_ID environment variable');
      console.log('');
      console.log('Or create a .env file with:');
      console.log('GOOGLE_API_KEY=your_api_key_here');
      console.log('GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here');
    }
  });

// Anthropic authentication commands
program
  .command('auth')
  .description('Manage Anthropic authentication')
  .addCommand(
    new Command('login')
      .description('Set up Anthropic authentication (OAuth or API key)')
      .action(async () => {
        try {
          await loginCommand();
        } catch (error) {
          console.error(
            'Login failed:',
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('logout')
      .description('Remove stored Anthropic credentials')
      .action(async () => {
        try {
          await logoutCommand();
        } catch (error) {
          console.error(
            'Logout failed:',
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('status')
      .description('Check Anthropic authentication status')
      .action(async () => {
        try {
          await statusCommand();
        } catch (error) {
          console.error(
            'Status check failed:',
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List stored authentication credentials')
      .action(async () => {
        try {
          await listCommand();
        } catch (error) {
          console.error(
            'List failed:',
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        }
      })
  );

program
  .command('prompt')
  .description('Test Anthropic provider with a prompt')
  .argument('<prompt>', 'Prompt to send to Claude')
  .action(async (prompt) => {
    try {
      const provider = await anthropicProvider;
      const result = await generateText({
        model: provider('claude-sonnet-4-20250514'),
        prompt: prompt,
      });
      console.log(result.text);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('research')
  .description('Perform deep research on a topic')
  .argument('<query>', 'Research query')
  .action(async (query) => {
    try {
      const report = await performDeepResearch(query);

      console.log('\n' + '='.repeat(80));
      console.log('RESEARCH REPORT');
      console.log('='.repeat(80));
      console.log(report.detailedFindings);
      console.log('\n' + '='.repeat(80));
      console.log(`Sources consulted: ${report.sources.length}`);
      console.log(`Total findings: ${report.metadata.findingsCount}`);
      console.log('='.repeat(80));
    } catch (error) {
      console.error(
        'Failed to complete research:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

program.parse();
