// Phase 4: Synthesis & Report Generation

import { generateText } from 'ai';
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
  const synthesis = await generateResearchSynthesis(state.query, state);

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
  state: ResearchState
): Promise<ResearchSynthesis> {
  const provider = await anthropicProvider;
  const findingsText = state.findings
    .map((f) => f.content)
    .join('\n</finding>\n<finding>\n');

  const result = await generateText({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `Synthesize comprehensive research findings for the query following the synthesis strategy.

<query>
${query}
</query>

<findings>
<finding>
${findingsText}
</finding>
</findings>

<synthesis-strategy>
${state.researchPlan?.synthesisStrategy}
</synthesis-strategy>


Create a thorough synthesis that:
1. Provides a clear executive summary
2. Presents detailed findings organized logically
3. Identifies key insights and patterns
4. Draws evidence-based conclusions

Focus on accuracy, coherence, and comprehensive coverage of the topic.

Return ONLY valid JSON in this exact format (no explanations, no markdown, no XML tags):

{
  "summary": "Executive summary of key findings (2-3 paragraphs)",
  "content": "Detailed findings and analysis (comprehensive, well-organized)",
  "keyInsights": ["3-5 most important insights discovered"],
  "conclusions": ["Evidence-based conclusions drawn from the research"]
}`,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 32000 },
      },
    },
  });

  return JSON.parse(result.text) as ResearchSynthesis;
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
${synthesis.conclusions.map((conclusion, i) => `${i + 1}. ${conclusion}`).join('\n')}

## Sources
${sources.map((src) => `- ${src}`).join('\n')}
`;

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
