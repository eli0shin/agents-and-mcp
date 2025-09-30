// Phase 2: Strategic Planning

import { generateText } from 'ai';
import { anthropicProvider } from '../../anthropic/index.js';
import { setResearchPlan, updatePhase } from '../state.js';
import { persistPrompt, persistResponse } from '../sessionStorage.js';
import {
  buildKnowledgeGapPrompt,
  buildResearchPlanPrompt,
} from '../prompts.js';
import type { ResearchState, ResearchPlan } from '../types.js';

export async function executeStrategicPlanning(
  state: ResearchState
): Promise<ResearchPlan> {
  // 1. Identify knowledge gaps
  const knowledgeGaps = await identifyResearchGaps(state);

  // 2. Generate targeted research plan
  const plan = await generateResearchPlan(state, knowledgeGaps);

  // 3. Update state with plan
  setResearchPlan(state, plan);
  updatePhase(state, 'planning');

  return plan;
}

async function identifyResearchGaps(state: ResearchState): Promise<string[]> {
  const provider = await anthropicProvider;
  const prompt = buildKnowledgeGapPrompt(state);
  const promptId = await persistPrompt(
    state.sessionId,
    buildKnowledgeGapPrompt.name,
    prompt
  );

  const { text } = await generateText({
    model: provider('claude-sonnet-4-5-20250929'),
    prompt,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 32000 },
      },
    },
  });

  await persistResponse(
    state.sessionId,
    buildKnowledgeGapPrompt.name,
    promptId,
    text
  );

  return text.split('\n').filter((gap) => gap.trim().length > 0);
}

async function generateResearchPlan(
  state: ResearchState,
  knowledgeGaps: string[]
): Promise<ResearchPlan> {
  const provider = await anthropicProvider;
  const prompt = buildResearchPlanPrompt(state, knowledgeGaps);
  const promptId = await persistPrompt(
    state.sessionId,
    buildResearchPlanPrompt.name,
    prompt
  );

  const result = await generateText({
    model: provider('claude-sonnet-4-5-20250929'),
    prompt,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 32000 },
      },
    },
  });

  await persistResponse(
    state.sessionId,
    buildResearchPlanPrompt.name,
    promptId,
    result.text
  );

  return JSON.parse(result.text) as ResearchPlan;
}
