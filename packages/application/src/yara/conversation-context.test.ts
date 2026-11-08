import { createConversationMessage } from '@yara/domain-yara-interaction';
import { describe, expect, it } from 'vitest';

import { buildBoundedConversationContext } from './conversation-context.js';

const conversationId = 'conversation:yara:11111111-1111-4111-8111-111111111111';

describe('bounded conversation context', () => {
  it('uses deterministic recent history and always retains the current user message', () => {
    const messages = Array.from({ length: 5 }, (_, index) =>
      createConversationMessage({
        id: `message:yara:00000000-0000-4000-8000-00000000000${index}`,
        conversationId,
        sequence: index + 1,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `message-${index}`,
        createdAt: new Date(`2026-11-06T10:00:0${index}.000Z`),
      }),
    );

    const context = buildBoundedConversationContext(messages, {
      maximumMessages: 3,
      maximumCharacters: 100,
      maximumOutputCharacters: 100,
    });
    expect(context.map((message) => message.content)).toEqual([
      'message-2',
      'message-3',
      'message-4',
    ]);
  });

  it('does not grow without bound when the conversation is long', () => {
    const messages = Array.from({ length: 4 }, (_, index) =>
      createConversationMessage({
        id: `message:yara:10000000-0000-4000-8000-00000000000${index}`,
        conversationId,
        sequence: index + 1,
        role: 'user',
        content: 'x'.repeat(40),
        createdAt: new Date(`2026-11-06T10:00:0${index}.000Z`),
      }),
    );
    const context = buildBoundedConversationContext(messages, {
      maximumMessages: 12,
      maximumCharacters: 90,
      maximumOutputCharacters: 100,
    });
    expect(context).toHaveLength(2);
    expect(context.reduce((sum, message) => sum + message.content.length, 0)).toBe(80);
  });
});
