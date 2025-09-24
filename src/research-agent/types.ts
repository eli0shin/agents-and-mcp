// Core data structures for the research agent

import type { SearchResult } from '../google-scraper/schemas.js';

export type ResearchPhase =
  | 'searching'
  | 'planning'
  | 'investigating'
  | 'synthesizing';

export type Finding = {
  id: string;
  content: string;
  source: string;
  timestamp: Date;
};

// Re-export SearchResult from google-scraper for consistency
export type { SearchResult };

export type WebContent = {
  content: string;
  title: string;
  author?: string;
  publishDate?: Date;
  wordCount: number;
  sourceUrl: string;
};

export type InvestigationStrategy = {
  question: string;
  approach: string;
  expectedSources: string[];
};

export type ResearchPlan = {
  researchQuestions: string[];
  investigationStrategies: InvestigationStrategy[];
  synthesisStrategy: string;
};

export type ResearchSynthesis = {
  summary: string;
  content: string;
  keyInsights: string[];
  conclusions: string[];
};

export type ResearchReport = {
  query: string;
  executiveSummary: string;
  detailedFindings: string;
  sources: string[];
  metadata: {
    findingsCount: number;
    sourcesConsulted: number;
  };
};

export type ResearchState = {
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

export type InitialSearchResult = {
  findings: Finding[];
  sources: SearchResult[];
};

// MCP Tool Response Types
export type ToolResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

export type GoogleSearchToolResponse = ToolResponse<SearchResult[]>;
export type WebFetchToolResponse = ToolResponse<string>;

// Error handling types
export type ResearchError = {
  phase: ResearchPhase;
  message: string;
  originalError?: unknown;
};
