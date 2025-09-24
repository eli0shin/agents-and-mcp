// Phase 2: Strategic Planning

import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { anthropicProvider } from '../../anthropic/index.js';
import { setResearchPlan, updatePhase } from '../state.js';
import type { ResearchState, ResearchPlan, Finding } from '../types.js';

export async function executeStrategicPlanning(
  state: ResearchState
): Promise<ResearchPlan> {
  const initialFindings = state.findings;

  // 1. Identify knowledge gaps
  const knowledgeGaps = await identifyResearchGaps(
    state.query,
    initialFindings
  );

  // 2. Generate targeted research plan
  const plan = await generateResearchPlan(
    state.query,
    initialFindings,
    knowledgeGaps
  );

  // 3. Update state with plan
  setResearchPlan(state, plan);
  updatePhase(state, 'planning');

  return plan;
}

async function identifyResearchGaps(
  query: string,
  findings: Finding[]
): Promise<string[]> {
  const provider = await anthropicProvider;
  const findingsText = findings.map((f) => f.content).join('\n');

  const { text } = await generateText({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `Given the research query "${query}" and these initial findings:

${findingsText}

What key information, perspectives, or aspects are still missing? 
List 3-5 specific knowledge gaps that need to be addressed for comprehensive research.
Format as a simple list, one gap per line.`,
  });

  return text.split('\n').filter((gap) => gap.trim().length > 0);
}

async function generateResearchPlan(
  query: string,
  initialFindings: Finding[],
  knowledgeGaps: string[]
): Promise<ResearchPlan> {
  const provider = await anthropicProvider;
  const findingsText = initialFindings.map((f) => f.content).join('\n');
  const gapsText = knowledgeGaps.join('\n');

  const result = await generateObject({
    model: provider('claude-sonnet-4-20250514'),
    prompt: `Based on the query "${query}", initial findings, and identified knowledge gaps, create a comprehensive research plan.

Initial Findings:
${findingsText}

Knowledge Gaps:
${gapsText}

Create a structured research plan that addresses these gaps and provides comprehensive coverage of the topic.`,
    schema: z.object({
      researchQuestions: z
        .array(z.string())
        .describe('3-5 specific research questions to investigate'),
      investigationStrategies: z
        .array(
          z.object({
            question: z
              .string()
              .describe('The research question this strategy addresses'),
            approach: z.string().describe('How to investigate this question'),
            expectedSources: z
              .array(z.string())
              .describe('Types of sources to look for'),
          })
        )
        .describe('Detailed strategies for each research question'),
      synthesisStrategy: z
        .string()
        .describe('How to combine all findings into a coherent report'),
    }),
  });

  return result.object;
}
