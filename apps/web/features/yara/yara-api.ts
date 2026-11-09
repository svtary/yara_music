import type {
  AIExecutionRunResponseContract,
  CreateConversationResponseContract,
  ListConversationsResponseContract,
  SendConversationMessageResponseContract,
  YaraConversationContract,
  YaraConversationSummaryContract,
} from '@yara/contracts';

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'not_found'
        : response.status === 409
          ? 'command_conflict'
          : 'request_failed',
    );
  }
  return response.json() as Promise<T>;
}

export async function createConversation(): Promise<YaraConversationContract> {
  const value = await json<CreateConversationResponseContract>(
    await fetch('/api/yara/conversations', { method: 'POST' }),
  );
  return value.conversation;
}

export async function startConversation(
  content: string,
  idempotencyKey: string,
): Promise<SendConversationMessageResponseContract> {
  return json(
    await fetch('/api/yara/conversations/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, idempotencyKey }),
    }),
  );
}

export async function listConversations(
  limit = 20,
): Promise<readonly YaraConversationSummaryContract[]> {
  const value = await json<ListConversationsResponseContract>(
    await fetch(`/api/yara/conversations?limit=${limit}`, { cache: 'no-store' }),
  );
  return value.conversations;
}

export async function getConversation(id: string): Promise<YaraConversationContract> {
  return json(
    await fetch(`/api/yara/conversations/${encodeURIComponent(id)}`, { cache: 'no-store' }),
  );
}

export async function sendConversationMessage(
  id: string,
  content: string,
  idempotencyKey: string,
): Promise<SendConversationMessageResponseContract> {
  return json(
    await fetch(`/api/yara/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, idempotencyKey }),
    }),
  );
}

export async function getRun(id: string): Promise<AIExecutionRunResponseContract> {
  return json(await fetch(`/api/yara/ai-runs/${encodeURIComponent(id)}`, { cache: 'no-store' }));
}

export async function cancelRun(id: string): Promise<AIExecutionRunResponseContract> {
  return json(
    await fetch(`/api/yara/ai-runs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  );
}
