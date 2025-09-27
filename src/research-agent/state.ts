// State management functions for research agent

import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  ResearchState,
  ResearchPhase,
  SearchResult,
  WebContent,
  Finding,
  ResearchPlan,
  ResearchReport,
} from './types.js';

const STATE_OUTPUT_DIRECTORY = join(process.cwd(), 'research-sessions');

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

async function persistResearchState(state: ResearchState): Promise<void> {
  try {
    await fs.mkdir(STATE_OUTPUT_DIRECTORY, { recursive: true });
    const outputPath = join(STATE_OUTPUT_DIRECTORY, `${state.sessionId}.json`);
    const serializedState = JSON.stringify(state, null, 2);
    await fs.writeFile(outputPath, serializedState, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to persist research state:', message);
  }
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

  void persistResearchState(state);

  return state;
}

export function updatePhase(
  state: ResearchState,
  phase: ResearchPhase
): ResearchState {
  state.currentPhase = phase;
  void persistResearchState(state);
  return state;
}

export function addSearchResults(
  state: ResearchState,
  results: SearchResult[]
): ResearchState {
  state.searchResults.push(...results);
  void persistResearchState(state);
  return state;
}

export function addWebContents(
  state: ResearchState,
  contents: WebContent[]
): ResearchState {
  state.webContents.push(...contents);
  void persistResearchState(state);
  return state;
}

export function addFindings(
  state: ResearchState,
  findings: Finding[]
): ResearchState {
  state.findings.push(...findings);
  void persistResearchState(state);
  return state;
}

export function setResearchPlan(
  state: ResearchState,
  plan: ResearchPlan
): ResearchState {
  state.researchPlan = plan;
  void persistResearchState(state);
  return state;
}

export function setReport(
  state: ResearchState,
  report: ResearchReport
): ResearchState {
  state.report = report;
  void persistResearchState(state);
  return state;
}

export function addFollowUpQueries(
  state: ResearchState,
  queries: string[]
): ResearchState {
  state.followUpQueries.push(...queries);
  void persistResearchState(state);
  return state;
}
