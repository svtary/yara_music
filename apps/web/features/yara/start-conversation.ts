import type { YaraConversationContract } from '@yara/contracts';

import { yaraConversationHref } from './yara-routes';

export interface StartConversationDependencies {
  readonly create: () => Promise<YaraConversationContract>;
  readonly send: (conversationId: string, content: string) => Promise<{ readonly runId: string }>;
}

export async function startConversationFromPrompt(
  content: string,
  dependencies: StartConversationDependencies,
): Promise<string> {
  const prompt = content.trim();
  if (!prompt) throw new Error('prompt_required');
  const conversation = await dependencies.create();
  const receipt = await dependencies.send(conversation.id, prompt);
  return yaraConversationHref(conversation.id, receipt.runId);
}
