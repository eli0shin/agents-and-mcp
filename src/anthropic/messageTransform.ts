/**
 * Message transformation utilities for provider-specific optimizations
 * Implements Anthropic OAuth-compatible message caching strategies
 */

/**
 * Anthropic native content format
 */
export type AnthropicContent = {
  type: 'text' | 'thinking' | 'redacted_thinking';
  text?: string;
  cache_control?: { type: 'ephemeral' };
};

/**
 * Anthropic native message format
 */
export type AnthropicMessage = {
  role: 'system' | 'user' | 'assistant';
  content: AnthropicContent[];
};

/**
 * Applies Anthropic-specific cache control optimizations to messages
 * Respects the 4-block cache_control limit by caching:
 * - Last system content block (1 block)
 * - Last content block in each of the last 3 messages (3 blocks)
 * Total: 4 blocks maximum
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

  // Apply cache control to last system content block (if exists)
  const systemWithCache = system.length > 0
    ? system.map((content, idx) => {
        if (idx === system.length - 1 && content.type !== 'thinking' && content.type !== 'redacted_thinking') {
          return { ...content, cache_control: { type: 'ephemeral' as const } };
        }
        return content;
      })
    : system;

  // Apply cache control to last content block in each of last 3 messages
  const messagesWithCache = messages.map((msg, msgIdx) => {
    const isLastThreeMessages = msgIdx >= messages.length - 3;
    if (!isLastThreeMessages || msg.content.length === 0) {
      return msg;
    }

    // Add cache_control to last non-thinking content block in this message
    const contentWithCache = msg.content.map((contentItem, contentIdx) => {
      const isLastContent = contentIdx === msg.content.length - 1;
      const isThinking = contentItem.type === 'thinking' || contentItem.type === 'redacted_thinking';

      if (isLastContent && !isThinking) {
        return { ...contentItem, cache_control: { type: 'ephemeral' as const } };
      }
      return contentItem;
    });

    return { ...msg, content: contentWithCache };
  });

  return {
    messages: messagesWithCache,
    system: systemWithCache,
  };
}
