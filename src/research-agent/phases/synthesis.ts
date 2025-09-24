// Phase 4: Synthesis & Report Generation

import { generateObject } from 'ai';
import { z } from 'zod';
import { anthropicProvider } from '../../anthropic/index.js';
import { setReport, updatePhase } from '../state.js';
import type {
  ResearchState,
  ResearchReport,
  ResearchSynthesis,
  Finding,
} from '../types.js';

export async function executeSynthesis(
  state: ResearchState
): Promise<ResearchReport> {
  const allFindings = state.findings;

  // 1. Generate comprehensive synthesis
  const synthesis = await generateResearchSynthesis(state.query, allFindings);

  // 2. Add citations and create final report
  const report = createFinalReport(
    state.query,
    synthesis,
    state.searchResults.map((r) => r.url),
    allFindings.length,
    state.webContents.length
  );

  // 3. Update state
  setReport(state, report);
  updatePhase(state, 'synthesizing');

  return report;
}

async function generateResearchSynthesis(
  query: string,
  findings: Finding[]
): Promise<ResearchSynthesis> {
  const provider = await anthropicProvider;
  const findingsText = findings.map((f) => f.content).join('\n\n---\n\n');

  const result = await generateObject({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `Synthesize comprehensive research findings for the query: "${query}"

Research Findings:
${findingsText}

Create a thorough synthesis that:
1. Provides a clear executive summary
2. Presents detailed findings organized logically
3. Identifies key insights and patterns
4. Draws evidence-based conclusions

Focus on accuracy, coherence, and comprehensive coverage of the topic.`,
    schema: z.object({
      summary: z
        .string()
        .describe('Executive summary of key findings (2-3 paragraphs)'),
      content: z
        .string()
        .describe(
          'Detailed findings and analysis (comprehensive, well-organized)'
        ),
      keyInsights: z
        .array(z.string())
        .describe('3-5 most important insights discovered'),
      conclusions: z
        .array(z.string())
        .describe('Evidence-based conclusions drawn from the research'),
    }),
  });

  return result.object;
}

function createFinalReport(
  query: string,
  synthesis: ResearchSynthesis,
  sources: string[],
  findingsCount: number,
  sourcesConsulted: number
): ResearchReport {
  // Create a comprehensive report with proper formatting
  const detailedFindings = `# Research Report: ${query}

## Executive Summary
${synthesis.summary}

## Detailed Findings
${synthesis.content}

## Key Insights
${synthesis.keyInsights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

## Conclusions
${synthesis.conclusions.map((conclusion, i) => `${i + 1}. ${conclusion}`).join('\n')}`;

  return {
    query,
    executiveSummary: synthesis.summary,
    detailedFindings,
    sources: [...new Set(sources)], // Remove duplicates
    metadata: {
      findingsCount,
      sourcesConsulted,
    },
  };
}
