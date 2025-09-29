// State management functions for research agent

import { randomBytes } from 'crypto';
import { persistState } from './sessionStorage.js';
import type {
  ResearchState,
  ResearchPhase,
  SearchResult,
  WebContent,
  Finding,
  ResearchPlan,
  ResearchReport,
} from './types.js';

function generateTimeUuid(): string {
  const timestamp = Date.now();
  const timeBuffer = Buffer.alloc(6);
  timeBuffer.writeUIntBE(timestamp, 0, 6);

  const random = randomBytes(10);
  const bytes = Buffer.concat([timeBuffer, random]);

  const versionByte = bytes[6] ?? 0;
  const variantByte = bytes[8] ?? 0;
  bytes[6] = (versionByte & 0x0f) | 0x70;
  bytes[8] = (variantByte & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// State management functions
export function initializeResearch(query: string): ResearchState {
  const state: ResearchState = {
    sessionId: generateTimeUuid(),
    query,
    currentPhase: 'searching',
    searchResults: [],
    webContents: [],
    findings: [],
    followUpQueries: [],
  };

  void persistState(state);

  return state;
}

export function updatePhase(
  state: ResearchState,
  phase: ResearchPhase
): ResearchState {
  state.currentPhase = phase;
  void persistState(state);
  return state;
}

export function addSearchResults(
  state: ResearchState,
  results: SearchResult[]
): ResearchState {
  state.searchResults.push(...results);
  void persistState(state);
  return state;
}

export function addWebContents(
  state: ResearchState,
  contents: WebContent[]
): ResearchState {
  state.webContents.push(...contents);
  void persistState(state);
  return state;
}

export function addFindings(
  state: ResearchState,
  findings: Finding[]
): ResearchState {
  state.findings.push(...findings);
  void persistState(state);
  return state;
}

export function setResearchPlan(
  state: ResearchState,
  plan: ResearchPlan
): ResearchState {
  state.researchPlan = plan;
  void persistState(state);
  return state;
}

export function setReport(
  state: ResearchState,
  report: ResearchReport
): ResearchState {
  state.report = report;
  void persistState(state);
  return state;
}

export function addFollowUpQueries(
  state: ResearchState,
  queries: string[]
): ResearchState {
  state.followUpQueries.push(...queries);
  void persistState(state);
  return state;
}
