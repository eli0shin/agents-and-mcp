// Phase 4: Synthesis & Report Generation

import { generateText } from 'ai';
import { anthropicProvider } from '../../anthropic/index.js';
import { setReport, updatePhase } from '../state.js';
import { persistPrompt, persistResponse } from '../sessionStorage.js';
import { buildResearchSynthesisPrompt } from '../prompts.js';
import type {
  ResearchState,
  ResearchReport,
  ResearchSynthesis,
} from '../types.js';

export async function executeSynthesis(
  state: ResearchState
): Promise<ResearchReport> {
  // 1. Generate comprehensive synthesis
  const synthesis = await generateResearchSynthesis(state);

  // 2. Add citations and create final report
  const report = createFinalReport(
    state,
    synthesis
  );

  // 3. Update state
  setReport(state, report);
  updatePhase(state, 'synthesizing');

  return report;
}

async function generateResearchSynthesis(
  state: ResearchState
): Promise<ResearchSynthesis> {
  const provider = await anthropicProvider;
  const prompt = buildResearchSynthesisPrompt(state);
  const promptId = await persistPrompt(
    state.sessionId,
    buildResearchSynthesisPrompt.name,
    prompt
  );

  const result = await generateText({
    model: provider('claude-sonnet-4-20250514'),
    prompt,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 32000 },
      },
    },
  });

  await persistResponse(
    state.sessionId,
    buildResearchSynthesisPrompt.name,
    promptId,
    result.text
  );

  return JSON.parse(result.text) as ResearchSynthesis;
}

function createFinalReport(
  state: ResearchState,
  synthesis: ResearchSynthesis
): ResearchReport {
  // Create a comprehensive report with proper formatting
  const detailedFindings = `# Research Report: ${state.query}

## Executive Summary
${synthesis.summary}

## Detailed Findings
${synthesis.content}

## Key Insights
${synthesis.keyInsights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

## Conclusions
${synthesis.conclusions.map((conclusion, i) => `${i + 1}. ${conclusion}`).join('\n')}

## Sources
${state.searchResults.map((r) => `- ${r.url}`).join('\n')}
`;

  return {
    query: state.query,
    executiveSummary: synthesis.summary,
    detailedFindings,
    sources: [...new Set(state.searchResults.map((r) => r.url))], // Remove duplicates
    metadata: {
      findingsCount: state.findings.length,
      sourcesConsulted: state.webContents.length,
    },
  };
}
