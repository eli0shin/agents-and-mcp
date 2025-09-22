/**
 * Anthropic Provider Module
 * Clean AI SDK provider with authentication handled automatically
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createAnthropicAuthFetch } from './anthropicAuth.js';
import { CredentialStore } from './auth/index.js';

/**
 * Anthropic provider with authentication and optimizations applied
 * Ready to use with the AI SDK
 *
 * @example
 * ```typescript
 * import { anthropicProvider } from './anthropic';
 * import { generateText } from 'ai';
 *
 * const result = await generateText({
 *   model: (await anthropicProvider)('claude-3-5-sonnet-20241022'),
 *   prompt: 'Hello, world!'
 * });
 * ```
 */
export const anthropicProvider = (async () => {
  // Try to get stored API key
  let resolvedApiKey: string | undefined;
  try {
    const credentials = await CredentialStore.get('anthropic');
    if (credentials?.type === 'api') {
      resolvedApiKey = credentials.key;
    }
  } catch {
    // Ignore credential store errors
  }

  // Create authenticated fetch function with OAuth preferred
  const authenticatedFetch = createAnthropicAuthFetch({
    apiKey: resolvedApiKey,
    authType: 'oauth',
    enableOAuth: true,
    preferOAuth: true,
    baseFetch: fetch
  });

  // Create and return the AI SDK provider with custom fetch
  return createAnthropic({
    fetch: authenticatedFetch
  });
})();

// Re-export auth commands for CLI integration
export {
  loginCommand,
  logoutCommand,
  listCommand,
  statusCommand
} from './authCommands.js';

// Re-export message transformation utility
export { transformMessagesForAnthropic } from './messageTransform.js';

// Re-export credential store for advanced usage
export { CredentialStore, AnthropicOAuth } from './auth/index.js';

// Re-export system prompt constants
export { DEFAULT_SYSTEM_PROMPT, buildSystemPrompt } from './constants.js';