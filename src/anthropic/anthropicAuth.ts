/**
 * Anthropic authentication wrapper for flexible header handling
 * Supports x-api-key, Bearer token, and OAuth authentication methods
 */

import { AnthropicOAuth } from './auth/index.js';
import {
  transformMessagesForAnthropic,
  type AnthropicContent,
  type AnthropicMessage,
} from './messageTransform.js';

type AnthropicRequestBody = {
  messages: AnthropicMessage[];
  system: AnthropicContent[];
  [key: string]: unknown;
};

type FetchFunction = typeof fetch;

type AuthOptions = {
  apiKey?: string;
  authType: 'x-api-key' | 'bearer' | 'oauth';
  customHeaders?: Record<string, string>;
  disableDefaultAuth?: boolean;
  enableOAuth?: boolean;
  preferOAuth?: boolean;
  oauthHeaders?: Record<string, string>;
  baseFetch?: typeof fetch;
};

/**
 * Creates a custom fetch function that handles different authentication methods
 * for the Anthropic API, including Bearer tokens, OAuth, and custom headers
 */
export function createAnthropicAuthFetch(options: AuthOptions): FetchFunction {
  const baseFetch = options.baseFetch || fetch;

  const authFetch = async (
    input: string | URL | Request,
    init: RequestInit = {}
  ) => {
    // Preserve existing headers from AI SDK (including anthropic-version)
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };

    // Handle authentication based on type and preferences
    if (!options.disableDefaultAuth) {
      let authHandled = false;

      // Try OAuth first if enabled or preferred
      if (
        options.authType === 'oauth' ||
        options.enableOAuth ||
        options.preferOAuth
      ) {
        try {
          // TODO: Implement OAuth token retrieval
          const oauthToken = await getOAuthToken();
          if (oauthToken) {
            headers.authorization = `Bearer ${oauthToken}`;

            // Add required headers unconditionally
            headers['Anthropic-Beta'] =
              'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14';
            headers['Anthropic-Dangerous-Direct-Browser-Access'] = 'true';
            headers['User-Agent'] = 'claude-cli/1.0.119 (external, cli)';
            headers['X-App'] = 'cli';

            // Remove x-api-key when using OAuth
            delete headers['x-api-key'];
            authHandled = true;

            // Add OAuth-specific headers
            if (options.oauthHeaders) {
              Object.entries(options.oauthHeaders).forEach(([key, value]) => {
                headers[key] = value;
              });
            }
          } else {
            console.debug('OAuth token not available', {
              reason: 'getOAuthToken returned undefined',
            });
          }
        } catch (error) {
          // OAuth failed - log error and continue to fallback logic
          console.warn('OAuth authentication failed', {
            error: error instanceof Error ? error.message : String(error),
            hasApiKeyFallback: !!options.apiKey,
          });
        }
      }

      // Fall back to API key if OAuth didn't work or wasn't preferred
      if (!authHandled && options.apiKey) {
        if (options.authType === 'bearer') {
          headers.Authorization = `Bearer ${options.apiKey}`;
        } else if (
          options.authType === 'x-api-key' ||
          options.authType === 'oauth'
        ) {
          // Use x-api-key for explicit x-api-key type or as OAuth fallback
          headers['x-api-key'] = options.apiKey;
        }
        authHandled = true;
      }

      // Error if no authentication method worked
      if (!authHandled) {
        console.error('No valid authentication method available', {
          hasApiKey: !!options.apiKey,
          authType: options.authType,
          enableOAuth: options.enableOAuth,
          preferOAuth: options.preferOAuth,
          disableDefaultAuth: options.disableDefaultAuth,
        });

        // If no API key was provided AND authType is oauth, show OAuth-specific error
        if (!options.apiKey && options.authType === 'oauth') {
          throw new Error(
            'OAuth authentication failed. Please run: npx . auth login'
          );
        } else {
          throw new Error(
            'No valid authentication found. Please run: npx . auth login'
          );
        }
      }
    } else {
      console.debug('Default authentication disabled', {
        disableDefaultAuth: options.disableDefaultAuth,
      });
    }

    // Add custom headers (excluding OAuth headers which are handled above)
    if (options.customHeaders) {
      Object.entries(options.customHeaders).forEach(([key, value]) => {
        headers[key] = value;
      });
    }

    // Transform request body if it's an Anthropic API call
    let finalInit = { ...init, headers };

    if (init.body && typeof init.body === 'string') {
      try {
        const bodyData = JSON.parse(init.body) as unknown;

        // Check if this is an Anthropic messages API call with proper type guard
        if (
          bodyData &&
          typeof bodyData === 'object' &&
          'messages' in bodyData &&
          Array.isArray((bodyData as AnthropicRequestBody).messages)
        ) {
          const typedBody = bodyData as AnthropicRequestBody;
          const transformed = transformMessagesForAnthropic(
            typedBody.messages,
            typedBody.system
          );
          const transformedBody: AnthropicRequestBody = {
            ...typedBody,
            system: transformed.system,
            messages: transformed.messages,
          };

          finalInit = {
            ...finalInit,
            body: JSON.stringify(transformedBody),
          };
        }
      } catch (error) {
        // If JSON parsing fails, continue with original body
        console.debug(
          'Failed to parse request body for transformation:',
          error
        );
      }
    }

    return baseFetch(input, finalInit);
  };

  // Copy over fetch properties to make it compatible with typeof fetch
  return Object.assign(authFetch, baseFetch) as FetchFunction;
}

// OAuth token retrieval using the actual implementation
async function getOAuthToken(): Promise<string | undefined> {
  return await AnthropicOAuth.getAccessToken();
}
