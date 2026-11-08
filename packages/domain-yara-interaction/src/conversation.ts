declare const conversationIdBrand: unique symbol;
declare const messageIdBrand: unique symbol;

export type ConversationId = string & { readonly [conversationIdBrand]: 'ConversationId' };
export type MessageId = string & { readonly [messageIdBrand]: 'MessageId' };

export type ConversationStatus = 'active' | 'archived';
export type ConversationMessageRole = 'user' | 'assistant';

export interface ConversationMessage {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly sequence: number;
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly status: 'committed';
  readonly createdAt: Date;
}

export interface YaraConversation {
  readonly id: ConversationId;
  readonly status: ConversationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly messages: readonly ConversationMessage[];
}

export type YaraInteractionInvariantCode =
  | 'INVALID_CONVERSATION_ID'
  | 'INVALID_MESSAGE_ID'
  | 'INVALID_CONVERSATION_STATUS'
  | 'INVALID_MESSAGE_ROLE'
  | 'INVALID_MESSAGE_CONTENT'
  | 'INVALID_MESSAGE_SEQUENCE'
  | 'INVALID_MESSAGE_TIMESTAMP'
  | 'MESSAGE_CONVERSATION_MISMATCH';

export class YaraInteractionInvariantError extends Error {
  public constructor(
    public readonly code: YaraInteractionInvariantCode,
    message: string,
  ) {
    super(message);
    this.name = 'YaraInteractionInvariantError';
  }
}

const opaqueIdentifier =
  /^[a-z][a-z0-9-]*:yara:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function parseIdentifier(
  value: string,
  prefix: 'conversation' | 'message',
  code: 'INVALID_CONVERSATION_ID' | 'INVALID_MESSAGE_ID',
): string {
  if (
    typeof value !== 'string' ||
    value.length > 96 ||
    !opaqueIdentifier.test(value) ||
    !value.startsWith(`${prefix}:yara:`)
  ) {
    throw new YaraInteractionInvariantError(
      code,
      `${prefix} identity must be a Yara-owned opaque UUID reference.`,
    );
  }
  return value;
}

function validDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new YaraInteractionInvariantError(
      'INVALID_MESSAGE_TIMESTAMP',
      `${label} must be a valid date.`,
    );
  }
  return new Date(value.getTime());
}

function validContent(value: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 20_000 ||
    value.trim() !== value ||
    value.includes('\u0000')
  ) {
    throw new YaraInteractionInvariantError(
      'INVALID_MESSAGE_CONTENT',
      'Conversation message content must be trimmed, non-empty text no longer than 20,000 characters.',
    );
  }
  return value;
}

export function conversationId(value: string): ConversationId {
  return parseIdentifier(value, 'conversation', 'INVALID_CONVERSATION_ID') as ConversationId;
}

export function messageId(value: string): MessageId {
  return parseIdentifier(value, 'message', 'INVALID_MESSAGE_ID') as MessageId;
}

export function createConversationMessage(input: {
  readonly id: string;
  readonly conversationId: string;
  readonly sequence: number;
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly createdAt: Date;
}): ConversationMessage {
  if (input.role !== 'user' && input.role !== 'assistant') {
    throw new YaraInteractionInvariantError(
      'INVALID_MESSAGE_ROLE',
      'Conversation messages may only use the user or assistant role in Stage 2.',
    );
  }
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new YaraInteractionInvariantError(
      'INVALID_MESSAGE_SEQUENCE',
      'Conversation message sequence must be a positive safe integer.',
    );
  }
  return Object.freeze({
    id: messageId(input.id),
    conversationId: conversationId(input.conversationId),
    sequence: input.sequence,
    role: input.role,
    content: validContent(input.content),
    status: 'committed' as const,
    createdAt: validDate(input.createdAt, 'Message createdAt'),
  });
}

export function createYaraConversation(input: {
  readonly id: string;
  readonly status?: ConversationStatus;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly messages?: readonly ConversationMessage[];
}): YaraConversation {
  const id = conversationId(input.id);
  const status = input.status ?? 'active';
  if (status !== 'active' && status !== 'archived') {
    throw new YaraInteractionInvariantError(
      'INVALID_CONVERSATION_STATUS',
      'Conversation status must be active or archived.',
    );
  }
  const createdAt = validDate(input.createdAt, 'Conversation createdAt');
  const updatedAt = validDate(input.updatedAt ?? input.createdAt, 'Conversation updatedAt');
  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new YaraInteractionInvariantError(
      'INVALID_MESSAGE_TIMESTAMP',
      'Conversation updatedAt cannot precede createdAt.',
    );
  }

  const messages = [...(input.messages ?? [])].sort(
    (left, right) => left.sequence - right.sequence,
  );
  for (const [index, message] of messages.entries()) {
    if (message.conversationId !== id) {
      throw new YaraInteractionInvariantError(
        'MESSAGE_CONVERSATION_MISMATCH',
        'Every message must belong to the containing YaraConversation.',
      );
    }
    if (message.sequence !== index + 1) {
      throw new YaraInteractionInvariantError(
        'INVALID_MESSAGE_SEQUENCE',
        'Committed conversation messages must have deterministic contiguous ordering.',
      );
    }
    if (message.createdAt.getTime() < createdAt.getTime()) {
      throw new YaraInteractionInvariantError(
        'INVALID_MESSAGE_TIMESTAMP',
        'A message cannot precede its conversation.',
      );
    }
  }

  return Object.freeze({
    id,
    status,
    createdAt,
    updatedAt,
    messages: Object.freeze(messages),
  });
}

export function appendCommittedMessage(
  conversation: YaraConversation,
  message: ConversationMessage,
): YaraConversation {
  if (conversation.status !== 'active') {
    throw new YaraInteractionInvariantError(
      'INVALID_CONVERSATION_STATUS',
      'Messages cannot be appended to an archived conversation.',
    );
  }
  if (message.conversationId !== conversation.id) {
    throw new YaraInteractionInvariantError(
      'MESSAGE_CONVERSATION_MISMATCH',
      'The message belongs to a different conversation.',
    );
  }
  if (message.sequence !== conversation.messages.length + 1) {
    throw new YaraInteractionInvariantError(
      'INVALID_MESSAGE_SEQUENCE',
      'The next committed message must use the next contiguous sequence.',
    );
  }
  return createYaraConversation({
    ...conversation,
    updatedAt: message.createdAt,
    messages: [...conversation.messages, message],
  });
}
