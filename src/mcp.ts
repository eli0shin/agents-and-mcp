import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { performGitCommit } from './git-commit-agent/index.js';
import { searchGoogle } from './google-scraper/index.js';
import { performDeepResearch } from './research-agent/index.js';
import { $ } from 'bun';

// Create an MCP server
const server = new McpServer({
  name: 'ccjs',
  version: '1.0.0',
  title: 'CCCJS MCP Server',
});

// Git commit tool
const commitInputSchema = {
  files: z
    .array(z.string())
    .optional()
    .describe('Files to stage (optional, stages all changes if not provided)'),
  dryRun: z
    .boolean()
    .optional()
    .describe('Generate commit message without committing'),
};
type CommitInput = z.infer<z.ZodObject<typeof commitInputSchema>>;

server.registerTool(
  'commit',
  {
    title: 'Git Commit Tool',
    description:
      'Creates git commits with contextually appropriate commit messages that follow repository conventions. Optionally stages specific files before committing. Use this when you need to commit code changes. If files array is provided, those files will be staged before committing. Set dryRun to true to preview the commit message without committing.',
    inputSchema: commitInputSchema,
  },
  async (input: CommitInput) => {
    const { files, dryRun } = input;
    try {
      // Stage files if provided
      if (files && files.length > 0) {
        await $`git add ${files}`;
      }

      const result = await performGitCommit({ dryRun: dryRun ?? false });

      return {
        content: [
          {
            type: 'text',
            text: result.success
              ? result.message
              : `Error: ${result.error || result.message}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to commit: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Web search tool
const searchInputSchema = {
  query: z.string().describe('Search query'),
  maxResults: z
    .number()
    .optional()
    .describe('Maximum number of results (1-100, default 10)'),
  startIndex: z
    .number()
    .optional()
    .describe('Starting index for results (1-based, default 1)'),
};
type SearchInput = z.infer<z.ZodObject<typeof searchInputSchema>>;

server.registerTool(
  'search',
  {
    title: 'Web Search Tool',
    description:
      'Searches the web and returns structured results with titles, URLs, and snippets. Use this to find relevant web pages, articles, documentation, or information on any topic. Supports pagination for retrieving up to 100 results per query.',
    inputSchema: searchInputSchema,
  },
  async (input: SearchInput) => {
    const { query, maxResults, startIndex } = input;
    try {
      const results = await searchGoogle(query, {
        maxResults: maxResults ?? 10,
        startIndex: startIndex ?? 1,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Web fetch tool
const fetchInputSchema = {
  url: z.string().describe('URL to fetch'),
};
type FetchInput = z.infer<z.ZodObject<typeof fetchInputSchema>>;

server.registerTool(
  'fetch',
  {
    title: 'Web Fetch Tool',
    description:
      'Fetches content from any URL. Use this to retrieve web pages, API responses, documentation, or any web-accessible content. Useful for accessing specific pages identified from search results.',
    inputSchema: fetchInputSchema,
  },
  async (input: FetchInput) => {
    const { url } = input;
    try {
      const response = await fetch(url);
      const text = await response.text();

      return {
        content: [
          {
            type: 'text',
            text: text,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Deep research tool
const researchInputSchema = {
  query: z.string().describe('Research query or topic'),
};
type ResearchInput = z.infer<z.ZodObject<typeof researchInputSchema>>;

server.registerTool(
  'research',
  {
    title: 'Deep Research Tool',
    description:
      'Performs comprehensive research on any topic and returns a detailed report with findings and sources. Use this for complex topics requiring thorough investigation across multiple sources. This is a long-running operation that may take several minutes.',
    inputSchema: researchInputSchema,
  },
  async (input: ResearchInput) => {
    const { query } = input;
    try {
      const report = await performDeepResearch(query);

      return {
        content: [
          {
            type: 'text',
            text: `# Research Report\n\n${report.detailedFindings}\n\n---\n\nSources: ${report.sources.length}\nFindings: ${report.metadata.findingsCount}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Add a dynamic greeting resource
server.registerResource(
  'greeting',
  new ResourceTemplate('greeting://{name}', { list: undefined }),
  {
    title: 'Greeting Resource', // Display name for UI
    description: 'Dynamic greeting generator',
  },
  (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${String(name)}!`,
      },
    ],
  })
);

// Research prompt
const researchTopicSchema = {
  topic: z.string().describe('Topic to research'),
};

server.registerPrompt(
  'research-topic',
  {
    title: 'Research Topic',
    description: 'Research a topic using web search and fetch tools',
    // @ts-expect-error - zod v4 upgrade sucks and mcp expects v3
    argsSchema: researchTopicSchema,
  },
  ({ topic }: z.infer<z.ZodObject<typeof researchTopicSchema>>) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Research the following topic: "${topic}"

Follow this iterative research process:

1. Use the search tool to find relevant web pages and articles
2. Use the fetch tool to retrieve and read content from promising URLs
3. Analyze what you've learned and identify gaps in your understanding
4. Conduct additional searches with refined queries to fill those gaps
5. Continue this cycle until you have a comprehensive understanding of the topic

Keep researching iteratively until you can confidently answer:
- What are the core concepts and key facts?
- What are the different perspectives or approaches?
- What are the important details and nuances?

Once you have sufficient understanding to provide an accurate and confident response, provide a comprehensive summary including:
1. Key facts and information about the topic
2. Different perspectives or approaches (if applicable)
3. Important details and context
4. Sources you consulted (include URLs)

Do NOT use the research tool - instead, use the search and fetch tools directly to conduct your investigation.`,
          },
        },
      ],
    };
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();

export async function startMcpServer() {
  await server.connect(transport);
}
