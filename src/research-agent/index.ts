// Main Research Agent Orchestration

import { initializeResearch } from './state.js';
import { executeInitialSearch } from './phases/initialSearch.js';
import { executeStrategicPlanning } from './phases/planning.js';
import { executeFanOutInvestigation } from './phases/fanout.js';
import { executeSynthesis } from './phases/synthesis.js';
import type { ResearchReport } from './types.js';

/**
 * Performs deep research on a given query using a multi-phase approach:
 * 1. Initial Search - Broad information gathering
 * 2. Strategic Planning - Analysis and strategy formulation
 * 3. Fan-Out Investigation - Parallel deep-dive investigations
 * 4. Synthesis - Comprehensive report generation
 */
export async function performDeepResearch(
  query: string
): Promise<ResearchReport> {
  // Initialize research state
  const state = initializeResearch(query);

  try {
    console.log(`🔍 Starting deep research on: "${query}"`);

    // Phase 1: Initial Search
    console.log('📊 Phase 1: Initial search and context building...');
    const initialResults = await executeInitialSearch(state);
    console.log(
      `✅ Found ${initialResults.findings.length} initial findings from ${initialResults.sources.length} sources`
    );

    // Phase 2: Planning
    console.log('🎯 Phase 2: Strategic planning...');
    const plan = await executeStrategicPlanning(state);
    console.log(
      `✅ Generated research plan with ${plan.researchQuestions.length} questions and ${plan.investigationStrategies.length} strategies`
    );
    console.log(
      '[LS] -> p/s/r/index.ts:38 -> plan.investigationStrategies: ',
      plan.investigationStrategies
    );
    console.log(
      '[LS] -> p/s/r/index.ts:38 -> plan.researchQuestions: ',
      plan.researchQuestions
    );

    // Phase 3: Fan-Out Investigation
    console.log('🔬 Phase 3: Fan-out investigation...');
    const detailedFindings = await executeFanOutInvestigation(state, plan);
    console.log(
      `✅ Completed detailed investigation with ${detailedFindings.length} additional findings`
    );

    // Phase 4: Synthesis
    console.log('📝 Phase 4: Synthesis and report generation...');
    const report = await executeSynthesis(state);
    console.log(
      `✅ Generated comprehensive report with ${report.metadata.findingsCount} total findings`
    );

    return report;
  } catch (error) {
    console.error('❌ Research failed:', error);

    // Return partial report with available data
    return {
      query,
      executiveSummary: 'Research was partially completed due to an error.',
      detailedFindings: state.findings.map((f) => f.content).join('\n\n'),
      sources: state.searchResults.map((r) => r.url),
      metadata: {
        findingsCount: state.findings.length,
        sourcesConsulted: state.webContents.length,
      },
    };
  }
}

// Re-export types for external use
export type { ResearchReport, ResearchState } from './types.js';
