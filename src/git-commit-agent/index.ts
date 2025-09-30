import { generateText, stepCountIs } from 'ai';
import { anthropicProvider } from '../anthropic/index.js';
import { bashTool, readFileTool } from './tools.js';
import { getSystemPrompt, getUserPrompt } from './prompts.js';
import type { CommitResult, GitCommitOptions } from './types.js';

/**
 * Performs intelligent git commit using AI to analyze and execute git operations
 */
export async function performGitCommit(
  options: GitCommitOptions = {}
): Promise<CommitResult> {
  try {
    console.log('🤖 Starting AI-powered git commit agent...');

    const provider = await anthropicProvider;

    const result = await generateText({
      model: provider('claude-sonnet-4-5-20250929'),
      tools: {
        bash: bashTool,
        readFile: readFileTool,
      },
      messages: [
        { role: 'system', content: getSystemPrompt(options) },
        { role: 'user', content: getUserPrompt(options) },
      ],
      stopWhen: stepCountIs(30),
    });

    // The AI has done all the work through tool calls
    // Parse the final response to understand what happened
    const finalMessage = result.text;

    // Check if the AI indicates success or failure
    const wasSuccessful =
      !finalMessage.toLowerCase().includes('error') &&
      !finalMessage.toLowerCase().includes('failed') &&
      !finalMessage.toLowerCase().includes('nothing to commit');

    if (options.dryRun) {
      return {
        success: true,
        message: finalMessage,
      };
    }

    return {
      success: wasSuccessful,
      message: finalMessage,
    };
  } catch (error) {
    console.error('❌ Git commit agent failed:', error);
    return {
      success: false,
      message: 'Git commit agent failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

