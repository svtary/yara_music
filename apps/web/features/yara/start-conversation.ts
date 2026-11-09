import { yaraConversationHref } from './yara-routes';

export interface StartConversationDependencies {
  readonly start: (
    content: string,
    idempotencyKey: string,
  ) => Promise<{ readonly conversationId: string; readonly runId: string }>;
}

export async function startConversationFromPrompt(
  content: string,
  idempotencyKey: string,
  dependencies: StartConversationDependencies,
): Promise<string> {
  const prompt = content.trim();
  if (!prompt) throw new Error('prompt_required');
  const receipt = await dependencies.start(prompt, idempotencyKey);
  return yaraConversationHref(receipt.conversationId, receipt.runId);
}
