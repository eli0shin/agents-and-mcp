// State management functions for research agent

import type {
  ResearchState,
  ResearchPhase,
  SearchResult,
  WebContent,
  Finding,
  ResearchPlan,
  ResearchReport,
} from './types.js';

// State management functions
export function initializeResearch(query: string): ResearchState {
  return {
    query,
    currentPhase: 'searching',
    searchResults: [],
    webContents: [],
    findings: [],
    followUpQueries: [],
  };
}

export function updatePhase(
  state: ResearchState,
  phase: ResearchPhase
): ResearchState {
  state.currentPhase = phase;
  return state;
}

export function addSearchResults(
  state: ResearchState,
  results: SearchResult[]
): ResearchState {
  state.searchResults.push(...results);
  return state;
}

export function addWebContents(
  state: ResearchState,
  contents: WebContent[]
): ResearchState {
  state.webContents.push(...contents);
  return state;
}

export function addFindings(
  state: ResearchState,
  findings: Finding[]
): ResearchState {
  state.findings.push(...findings);
  return state;
}

export function setResearchPlan(
  state: ResearchState,
  plan: ResearchPlan
): ResearchState {
  state.researchPlan = plan;
  return state;
}

export function setReport(
  state: ResearchState,
  report: ResearchReport
): ResearchState {
  state.report = report;
  return state;
}

export function addFollowUpQueries(
  state: ResearchState,
  queries: string[]
): ResearchState {
  state.followUpQueries.push(...queries);
  return state;
}
