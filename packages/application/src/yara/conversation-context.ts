import type { ModelInputMessage } from '@yara/ai-runtime';
import type { ConversationMessage } from '@yara/domain-yara-interaction';

export interface ConversationContextPolicy {
  readonly maximumMessages: number;
  readonly maximumCharacters: number;
  readonly maximumOutputCharacters: number;
}

export const stageTwoConversationContextPolicy: ConversationContextPolicy = Object.freeze({
  maximumMessages: 12,
  maximumCharacters: 12_000,
  maximumOutputCharacters: 12_000,
});

export const stageTwoSystemInstruction =
  'You are Yara, a warm, concise music companion. Answer from the provided conversation only. ' +
  'Do not claim memory, retrieval, citations, recommendations, tools, or private context. ' +
  'If the conversation does not support a factual claim, say what is uncertain.';

export function buildBoundedConversationContext(
  messages: readonly ConversationMessage[],
  policy: ConversationContextPolicy = stageTwoConversationContextPolicy,
): readonly ModelInputMessage[] {
  const selected: ConversationMessage[] = [];
  let characters = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const wouldExceedMessageLimit = selected.length >= policy.maximumMessages;
    const wouldExceedCharacterLimit =
      characters + message.content.length > policy.maximumCharacters;
    if (wouldExceedMessageLimit || (wouldExceedCharacterLimit && selected.length > 0)) break;
    selected.push(message);
    characters += message.content.length;
  }

  return Object.freeze(
    selected.reverse().map((message) =>
      Object.freeze({
        role: message.role,
        content:
          message.content.length <= policy.maximumCharacters
            ? message.content
            : message.content.slice(-policy.maximumCharacters),
      }),
    ),
  );
}
