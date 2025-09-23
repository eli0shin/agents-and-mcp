/**
 * Message transformation utilities for provider-specific optimizations
 * Implements Anthropic OAuth-compatible message caching strategies
 */

/**
 * Anthropic native content format
 */
type AnthropicContent = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

/**
 * Anthropic native message format
 */
type AnthropicMessage = {
  role: 'system' | 'user' | 'assistant';
  content: AnthropicContent[];
};

/**
 * Applies Anthropic-specific cache control optimizations to messages
 * Only caches: first 2 system messages + last 2 non-system messages
 * Returns Anthropic native format with content arrays
 */
export function transformMessagesForAnthropic(
  messages: AnthropicMessage[],
  system: AnthropicContent[] = []
) {
  system.unshift({
    type: 'text',
    text: "You are Claude Code, Anthropic's official CLI for Claude.",
  });

  // Apply cache control strategy: first 2 system + last 2 non-system
  const systemMessageIndices: number[] = [];
  const nonSystemMessageIndices: number[] = [];
  system.forEach((_, index) => {
    systemMessageIndices.push(index);
  });

  messages.forEach((_, index) => {
    nonSystemMessageIndices.push(index);
  });

  // Get indices for messages to cache
  const systemMessagesToCache = systemMessageIndices.slice(0, 2); // First 2 system messages
  const nonSystemMessagesToCache = nonSystemMessageIndices.slice(-2); // Last 2 non-system messages

  // Apply cache control to existing content arrays
  const systemWithCache = system.map(
    addCacheToSystemMessages(systemMessagesToCache)
  );
  const messagesWithCache = messages.map(
    addCacheToMessages(nonSystemMessagesToCache)
  );

  return {
    messages: messagesWithCache,
    system: systemWithCache,
  };
}
function addCacheToMessages(indicesToCache: number[]) {
  return (msg: AnthropicMessage, index: number) => {
    const shouldCache = indicesToCache.includes(index);

    if (!shouldCache) {
      return msg;
    }

    // Add cache control to content items
    const contentWithCache: AnthropicContent[] = msg.content.map(
      (contentItem) => ({
        ...contentItem,
        cache_control: { type: 'ephemeral' as const },
      })
    );

    return {
      ...msg,
      content: contentWithCache,
    };
  };
}

function addCacheToSystemMessages(indicesToCache: number[]) {
  return (msg: AnthropicContent, index: number) => {
    const shouldCache = indicesToCache.includes(index);

    if (!shouldCache) {
      return msg;
    }

    // Add cache control to content items
    return {
      ...msg,
      cache_control: { type: 'ephemeral' as const },
    };
  };
}
