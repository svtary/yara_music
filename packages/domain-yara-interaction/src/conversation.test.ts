import { describe, expect, it } from 'vitest';

import {
  appendCommittedMessage,
  conversationId,
  createConversationMessage,
  createYaraConversation,
  messageId,
  YaraInteractionInvariantError,
} from './conversation.js';

const conversation = 'conversation:yara:11111111-1111-4111-8111-111111111111';
const firstMessage = 'message:yara:22222222-2222-4222-8222-222222222222';
const secondMessage = 'message:yara:33333333-3333-4333-8333-333333333333';
const createdAt = new Date('2026-11-06T10:00:00.000Z');

describe('YaraConversation', () => {
  it('keeps ConversationId and MessageId as distinct Yara-owned references', () => {
    expect(conversationId(conversation)).toBe(conversation);
    expect(messageId(firstMessage)).toBe(firstMessage);
    expect(() => conversationId(firstMessage)).toThrow(YaraInteractionInvariantError);
    expect(() => messageId(conversation)).toThrow(YaraInteractionInvariantError);
  });

  it('stores only committed user/assistant messages in contiguous order', () => {
    const empty = createYaraConversation({ id: conversation, createdAt });
    const user = createConversationMessage({
      id: firstMessage,
      conversationId: conversation,
      sequence: 1,
      role: 'user',
      content: 'Why does this record still feel immediate?',
      createdAt,
    });
    const assistant = createConversationMessage({
      id: secondMessage,
      conversationId: conversation,
      sequence: 2,
      role: 'assistant',
      content: 'Its texture is large, while the performance remains close.',
      createdAt: new Date(createdAt.getTime() + 1000),
    });

    const withUser = appendCommittedMessage(empty, user);
    const complete = appendCommittedMessage(withUser, assistant);
    expect(
      complete.messages.map((message) => [message.sequence, message.role, message.status]),
    ).toEqual([
      [1, 'user', 'committed'],
      [2, 'assistant', 'committed'],
    ]);
  });

  it('rejects malformed identity, invalid role, blank content, and ordering gaps', () => {
    expect(() => conversationId('provider-thread-123')).toThrow(YaraInteractionInvariantError);
    expect(() =>
      createConversationMessage({
        id: firstMessage,
        conversationId: conversation,
        sequence: 1,
        role: 'tool' as 'user',
        content: 'not allowed',
        createdAt,
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_MESSAGE_ROLE' }));
    expect(() =>
      createConversationMessage({
        id: firstMessage,
        conversationId: conversation,
        sequence: 1,
        role: 'user',
        content: '   ',
        createdAt,
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_MESSAGE_CONTENT' }));

    const empty = createYaraConversation({ id: conversation, createdAt });
    const gap = createConversationMessage({
      id: secondMessage,
      conversationId: conversation,
      sequence: 2,
      role: 'assistant',
      content: 'A gap is not a valid committed history.',
      createdAt,
    });
    expect(() => appendCommittedMessage(empty, gap)).toThrowError(
      expect.objectContaining({ code: 'INVALID_MESSAGE_SEQUENCE' }),
    );
  });
});
