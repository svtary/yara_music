import type { AIExecutionRunView, YaraConversationSummaryView } from '@yara/application';
import type {
  AIExecutionRunContract,
  AIExecutionRunResponseContract,
  ConversationMessageContract,
  YaraConversationSummaryContract,
  YaraConversationContract,
} from '@yara/contracts';
import type { ConversationMessage, YaraConversation } from '@yara/domain-yara-interaction';

export function presentMessage(message: ConversationMessage): ConversationMessageContract {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

export function presentConversationSummary(
  summary: YaraConversationSummaryView,
): YaraConversationSummaryContract {
  return {
    ...summary,
    updatedAt: summary.updatedAt.toISOString(),
  };
}

export function presentConversation(conversation: YaraConversation): YaraConversationContract {
  return {
    id: conversation.id,
    status: conversation.status,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map(presentMessage),
  };
}

export function presentRun(view: AIExecutionRunView): AIExecutionRunResponseContract {
  const run: AIExecutionRunContract = {
    id: view.run.id,
    conversationId: view.run.conversationId,
    triggerMessageId: view.run.triggerMessageId,
    status: view.run.status,
    provider: view.run.provider,
    model: view.run.model,
    ...(view.run.failure ? { failure: view.run.failure } : {}),
    createdAt: view.run.createdAt.toISOString(),
    ...(view.run.startedAt ? { startedAt: view.run.startedAt.toISOString() } : {}),
    ...(view.run.finishedAt ? { finishedAt: view.run.finishedAt.toISOString() } : {}),
  };
  return {
    run,
    ...(view.assistantMessage ? { assistantMessage: presentMessage(view.assistantMessage) } : {}),
  };
}
