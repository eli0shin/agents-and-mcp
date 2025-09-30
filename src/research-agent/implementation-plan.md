# Deep Research Agent Implementation Plan

## Overview

This document outlines the implementation plan for a deep research agent using the Vercel AI SDK. The agent will perform comprehensive, multi-step research by orchestrating search queries, analyzing results, and synthesizing findings through an iterative search-plan-execute workflow.

## Core Architecture

### High-Level Design Pattern

The research agent follows a **Search → Plan → Fan-Out → Synthesis** architecture:

1. **Search Phase**: Initial broad information gathering
2. **Planning Phase**: Analysis and strategy formulation based on initial findings
3. **Fan-Out Phase**: Parallel deep-dive investigations into specific aspects
4. **Synthesis Phase**: Aggregation and coherent presentation of findings

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Query Input   │───▶│  Research Agent │───▶│ Research Report │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     Core Components     │
                    │                         │
                    │ • Search Orchestrator   │
                    │ • Planning Engine       │
                    │ • Synthesis Engine      │
                    └─────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │        Tools           │
                    │                         │
                    │ • Google Search Tool    │
                    │ • Web Fetch Tool        │
                    │   (with content extract)│
                    └─────────────────────────┘
```

## Component Specifications

### 1. Google Search Tool

**Purpose**: Primary information discovery interface
**Implementation**: Vercel AI SDK tool using Google Custom Search API

```typescript
const googleSearchTool = tool({
  description: 'Search Google for information using Custom Search API',
  parameters: z.object({
    query: z.string().describe('Search query to execute'),
    maxResults: z.number().default(10).max(100).describe('Maximum number of results to return'),
    startIndex: z.number().default(1).describe('Starting index for pagination'),
  }),
  execute: async ({ query, maxResults, startIndex }) => {
    const { searchGoogle } = await import('../src/google-scraper');
    return await searchGoogle(query, { maxResults, startIndex });
  },
});
```

**Key Features**:

- Pagination support with startIndex
- Configurable result limits (max 100)
- Built-in error handling and validation
- Rate limiting and retry logic

### 2. Web Fetch Tool with Integrated Content Extraction

**Purpose**: Fetch web pages and extract structured, readable content in a single operation
**Implementation**: All-in-one fetch with intelligent content parsing and extraction

```typescript
import { NodeHtmlMarkdown } from 'node-html-markdown';

const webFetchTool = tool({
  description: 'Fetch web pages and convert to markdown',
  parameters: z.object({
    url: z.string().url().describe('URL to fetch content from'),
    max_length: z.number().default(5000).describe('Maximum number of characters to return'),
    start_index: z.number().default(0).describe('Start content from this character index'),
  }),
  execute: async ({ url, max_length, start_index }) => {
    try {
      // Fetch the content
      const response = await fetch(url);
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
      if (start_index > 0) {
        content = content.substring(start_index);
      }
      if (content.length > max_length) {
        content = content.substring(0, max_length);
      }
      
      return content;
    } catch (error) {
      return `Error fetching ${url}: ${error.message}`;
    }
  },
});
```

**Key Features**:

- **Smart content detection**: Automatically converts HTML to markdown, returns other content types as-is
- **Fast HTML conversion**: Uses node-html-markdown library (1.57x faster than turndown)
- **Content chunking**: Use start_index to read large pages in chunks
- **Length control**: Configurable max_length for response size
- **Clean markdown output**: Optimized for human readability with consistent spacing
- **Error handling**: Graceful failures with error messages

### 3. Research State Management

**Purpose**: Track research progress and accumulated knowledge
**Architecture**: Simple state object for current session

```typescript
type ResearchPhase =
  | 'searching'
  | 'planning'
  | 'investigating'
  | 'synthesizing';

type ResearchState = {
  // Core context
  query: string;
  currentPhase: ResearchPhase;

  // Accumulated data
  searchResults: SearchResult[];
  webContents: WebContent[];
  findings: Finding[];

  // Research plan
  researchPlan?: ResearchPlan;
  followUpQueries: string[];

  // Final output
  report?: ResearchReport;
};

// State management functions
function initializeResearch(query: string): ResearchState {
  return {
    query,
    currentPhase: 'searching',
    searchResults: [],
    webContents: [],
    findings: [],
    followUpQueries: [],
  };
}

function updatePhase(state: ResearchState, phase: ResearchPhase): ResearchState {
  state.currentPhase = phase;
  return state;
}

function addSearchResults(state: ResearchState, results: SearchResult[]): ResearchState {
  state.searchResults.push(...results);
  return state;
}

function addWebContents(state: ResearchState, contents: WebContent[]): ResearchState {
  state.webContents.push(...contents);
  return state;
}

function addFindings(state: ResearchState, findings: Finding[]): ResearchState {
  state.findings.push(...findings);
  return state;
}

function setResearchPlan(state: ResearchState, plan: ResearchPlan): ResearchState {
  state.researchPlan = plan;
  return state;
}

function setReport(state: ResearchState, report: ResearchReport): ResearchState {
  state.report = report;
  return state;
}
```

### 4. Planning Engine

**Purpose**: Intelligent research strategy formulation
**Implementation**: LLM-powered planning with structured output

```typescript
// Research planning functions
async function generateResearchPlan(
  query: string,
  initialFindings: Finding[]
): Promise<ResearchPlan> {
  return await generateObject({
    model: 'openai/gpt-4o',
    prompt: `Based on the query "${query}" and initial findings, create a comprehensive research plan...`,
    schema: z.object({
      researchQuestions: z.array(z.string()),
      investigationStrategies: z.array(
        z.object({
          question: z.string(),
          approach: z.string(),
          expectedSources: z.array(z.string()),
        })
      ),
      synthesisStrategy: z.string(),
    }),
  });
}

async function adaptResearchPlan(
  currentPlan: ResearchPlan,
  newFindings: Finding[]
): Promise<ResearchPlan> {
  // Dynamic plan adjustment based on discovered information
  const result = await generateObject({
    model: 'openai/gpt-4o',
    prompt: `Adapt this research plan based on new findings...`,
    schema: ResearchPlanSchema,
  });

  return result.object;
}
```

## Process Flow Implementation

### Phase 1: Initial Search & Context Building

```typescript
async function executeInitialSearch(
  query: string,
  state: ResearchState
): Promise<InitialSearchResult> {
  // 1. Generate diverse search queries
  const searchQueries = await generateInitialSearchQueries(query);

  // 2. Execute parallel searches
  const searchPromises = searchQueries.map((q) =>
    executeWebSearch(q, { maxResults: 8 })
  );
  const searchResults = await Promise.all(searchPromises);

  // 3. Quick relevance filtering
  const relevantResults = await filterRelevantResults(
    searchResults.flat(),
    query
  );

  // 4. Extract key information
  const initialFindings = await extractInitialFindings(relevantResults);

  // 5. Update state
  addSearchResults(state, relevantResults);
  addFindings(state, initialFindings);
  updatePhase(state, 'searching');

  return {
    findings: initialFindings,
    sources: relevantResults,
  };
}

async function generateInitialSearchQueries(query: string): Promise<string[]> {
  const result = await generateObject({
    model: 'openai/gpt-4o',
    prompt: `Generate 4-6 diverse search queries for comprehensive research on: "${query}"`,
    schema: z.object({
      queries: z.array(z.string()),
    }),
  });
  return result.object.queries;
}

async function filterRelevantResults(
  results: SearchResult[],
  originalQuery: string
): Promise<SearchResult[]> {
  // Simple relevance filtering based on query terms
  const queryWords = originalQuery.toLowerCase().split(' ');
  return results.filter((result) => {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    const matchCount = queryWords.filter((word) => text.includes(word)).length;
    return matchCount >= queryWords.length * 0.5;
  });
}
```

### Phase 2: Strategic Planning

```typescript
async function executeStrategicPlanning(
  state: ResearchState
): Promise<ResearchPlan> {
  const initialFindings = state.findings;

  // 1. Identify knowledge gaps
  const knowledgeGaps = await identifyResearchGaps(
    state.query,
    initialFindings
  );

  // 2. Generate targeted research plan
  const plan = await generateResearchPlan(state.query, initialFindings);

  // 3. Update state with plan
  setResearchPlan(state, plan);
  updatePhase(state, 'planning');

  return plan;
}

async function identifyResearchGaps(
  query: string,
  findings: Finding[]
): Promise<string[]> {
  // Use LLM to identify what's missing
  const { text } = await generateText({
    model: 'openai/gpt-4o',
    prompt: `Given the query "${query}" and current findings, what key information is still missing?`,
  });

  return text.split('\n').filter((gap) => gap.length > 0);
}
```

### Phase 3: Fan-Out Investigation

```typescript
async function executeFanOutInvestigation(
  state: ResearchState,
  plan: ResearchPlan
): Promise<Finding[]> {
  const investigations = plan.investigationStrategies;

  // 1. Execute all investigations in parallel
  const investigationPromises = investigations.map((strategy) =>
    executeInvestigationStrategy(strategy)
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
  strategy: InvestigationStrategy
): Promise<Finding[]> {
  // 1. Generate specialized search queries
  const queries = await generateSpecializedQueries(strategy);

  // 2. Execute searches in parallel
  const searchPromises = queries.map((query) =>
    googleSearchTool.execute({
      query: query,
      numResults: 6,
    })
  );

  const allSearchResults = await Promise.all(searchPromises);

  // 3. Fetch content from top results
  const contentPromises = allSearchResults.flatMap((searchResults) =>
    searchResults.items.slice(0, 3).map((item) =>
      webFetchTool.execute({
        url: item.link,
        extractionMode: 'main',
        outputFormat: 'markdown',
      })
    )
  );

  const contents = await Promise.all(contentPromises);

  // 4. Extract insights from content
  const insights = await extractInsightsFromContent(
    contents,
    strategy.question
  );

  return insights;
}
```

### Phase 4: Synthesis

```typescript
async function executeSynthesis(state: ResearchState): Promise<ResearchReport> {
  const allFindings = state.findings;

  // 1. Generate comprehensive synthesis
  const synthesis = await generateResearchSynthesis(state.query, allFindings);

  // 2. Add citations
  const citedReport = await addCitationsToReport(
    synthesis,
    state.searchResults
  );

  // 3. Final report generation
  const report = {
    query: state.query,
    executiveSummary: citedReport.summary,
    detailedFindings: citedReport.content,
    sources: state.searchResults.map((r) => r.link),
    metadata: {
      findingsCount: allFindings.length,
      sourcesConsulted: state.webContents.length,
    },
  };

  setReport(state, report);
  updatePhase(state, 'synthesizing');

  return report;
}

async function generateResearchSynthesis(
  query: string,
  findings: Finding[]
): Promise<ResearchSynthesis> {
  const result = await generateObject({
    model: 'openai/gpt-4o',
    prompt: `Synthesize research findings for: "${query}"...`,
    schema: z.object({
      summary: z.string(),
      content: z.string(),
      keyInsights: z.array(z.string()),
      conclusions: z.array(z.string()),
    }),
  });

  return result.object;
}
```

## Data Schema Definitions

```typescript
// Core data structures (simplified from 20+ to essential types only)

type Finding = {
  id: string;
  content: string;
  source: string;
  timestamp: Date;
};

type SearchResult = {
  title: string;
  link: string;
  snippet: string;
};

type WebContent = {
  content: string;
  title: string;
  author?: string;
  publishDate?: Date;
  wordCount: number;
  sourceUrl: string;
};

type InvestigationStrategy = {
  question: string;
  approach: string;
  expectedSources: string[];
};

type ResearchPlan = {
  researchQuestions: string[];
  investigationStrategies: InvestigationStrategy[];
  synthesisStrategy: string;
};

type ResearchSynthesis = {
  summary: string;
  content: string;
  keyInsights: string[];
  conclusions: string[];
};

type ResearchReport = {
  query: string;
  executiveSummary: string;
  detailedFindings: string;
  sources: string[];
  metadata: {
    findingsCount: number;
    sourcesConsulted: number;
  };
};
```

## Main Orchestration Function

```typescript
async function performDeepResearch(query: string): Promise<ResearchReport> {
  // Initialize research state
  const state = initializeResearch(query);

  try {
    // Phase 1: Initial Search
    const initialResults = await executeInitialSearch(query, state);

    // Phase 2: Planning
    const plan = await executeStrategicPlanning(state);

    // Phase 3: Fan-Out Investigation
    const detailedFindings = await executeFanOutInvestigation(state, plan);

    // Phase 4: Synthesis
    const report = await executeSynthesis(state);

    return report;
  } catch (error) {
    console.error('Research failed:', error);

    // Return partial report with available data
    return {
      query,
      executiveSummary: 'Research was partially completed.',
      detailedFindings: state.findings.map((f) => f.content).join('\n'),
      sources: state.searchResults.map((r) => r.link),
      metadata: {
        findingsCount: state.findings.length,
        sourcesConsulted: state.webContents.length,
      },
    };
  }
}
```

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)

- [ ] Set up Vercel AI SDK project structure
- [ ] Implement Google Search Tool function
- [ ] Implement Web Fetch Tool with integrated content extraction
- [ ] Create data schemas and TypeScript types

### Phase 2: Basic Research Flow (Week 2)

- [ ] Implement initial search functions
- [ ] Build relevance filtering functions
- [ ] Create research planning functions
- [ ] Implement basic synthesis functions

### Phase 3: Advanced Features (Week 3)

- [ ] Implement fan-out investigation functions
- [ ] Add citation generation
- [ ] Create comprehensive reporting functions
- [ ] Add error handling and resilience

### Phase 4: Testing & Optimization (Week 4)

- [ ] End-to-end testing of research flow
- [ ] Performance optimization
- [ ] Documentation and examples

## Error Handling & Resilience

### Failure Modes

1. **API Failures**: Graceful degradation by dropping results
2. **Content Extraction Failures**: Skip problematic URLs, continue with available content
3. **Rate Limiting**: Automatic retry with exponential backoff

### Recovery Strategies

```typescript
async function handleSearchFailure(
  query: string,
  error: Error
): Promise<SearchResult[]> {
  console.warn(`Search failure for query "${query}":`, error.message);
  // Drop failed searches, return empty results
  return [];
}

async function handleContentFetchFailure(
  url: string,
  error: Error
): Promise<WebContent | null> {
  console.warn(`Fetch failure for URL "${url}":`, error.message);
  return null;
}
```

## Key Simplifications from Original Plan

1. **Simplified memory**: No session IDs or complex persistence - just current state object
2. **Reduced types**: From 20+ to 8 essential types
3. **No state machine**: Simple phase tracking without formal transitions
4. **No quality metrics**: Just relevance scoring
5. **No use-case configs**: One general-purpose approach
6. **No priority systems**: Process all strategies equally
7. **No cross-validation**: Trust LLM synthesis
8. **Merged similar operations**: Combined redundant functions

This implementation plan maintains the sophisticated multi-phase research architecture while removing genuinely unnecessary complexity. The design emphasizes:

- **Multi-phase research flow** for comprehensive investigation
- **Parallel processing** for performance
- **LLM-powered planning** for intelligent research strategies
- **Clean data flow** through well-defined phases
- **Practical implementation** focus without premature optimization
