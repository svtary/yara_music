import {
  cancelAIExecutionRun,
  completeAIExecutionRun,
  failAIExecutionRun,
  startAIExecutionRun,
  ModelProviderError,
  type AgentRuntimePort,
  type AIExecutionFailure,
  type AIExecutionRun,
  type AIExecutionRunId,
  type ModelUsage,
} from '@yara/ai-runtime';
import {
  appendCommittedMessage,
  createConversationMessage,
  type ConversationId,
  type MessageId,
  type YaraConversation,
} from '@yara/domain-yara-interaction';
import { describe, expect, it } from 'vitest';

import {
  ConversationApplicationService,
  ConversationExecutionService,
} from './conversation-service.js';
import type {
  AIExecutionRunView,
  StoredYaraRunEvent,
  YaraInteractionPersistencePort,
  YaraRunEvent,
} from './yara-interaction-port.js';

class MemoryYaraPersistence implements YaraInteractionPersistencePort {
  public readonly conversations = new Map<string, { owner: string; value: YaraConversation }>();
  public readonly runs = new Map<string, AIExecutionRunView>();
  public readonly events = new Map<string, StoredYaraRunEvent[]>();

  public async createConversation(ownerRef: string, conversation: YaraConversation): Promise<void> {
    this.conversations.set(conversation.id, { owner: ownerRef, value: conversation });
  }

  public async getConversation(id: ConversationId): Promise<YaraConversation | null> {
    return this.conversations.get(id)?.value ?? null;
  }

  public async getConversationForOwner(
    owner: string,
    id: ConversationId,
  ): Promise<YaraConversation | null> {
    const value = this.conversations.get(id);
    return value?.owner === owner ? value.value : null;
  }

  public async listMeaningfulConversationsForOwner(owner: string, limit: number) {
    return [...this.conversations.values()]
      .filter(
        (stored) =>
          stored.owner === owner &&
          stored.value.messages.some((message) => message.role === 'user'),
      )
      .map((stored) => stored.value)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, limit);
  }

  public async acceptUserMessageAndRun(input: {
    readonly ownerRef: string;
    readonly messageId: MessageId;
    readonly conversationId: ConversationId;
    readonly content: string;
    readonly createdAt: Date;
    readonly run: AIExecutionRun;
  }) {
    const stored = this.conversations.get(input.conversationId);
    if (!stored || stored.owner !== input.ownerRef) throw new Error('not found');
    const message = createConversationMessage({
      id: input.messageId,
      conversationId: input.conversationId,
      sequence: stored.value.messages.length + 1,
      role: 'user',
      content: input.content,
      createdAt: input.createdAt,
    });
    stored.value = appendCommittedMessage(stored.value, message);
    this.runs.set(input.run.id, { run: input.run });
    return { message, run: input.run };
  }

  public async getRun(id: AIExecutionRunId): Promise<AIExecutionRunView | null> {
    return this.runs.get(id) ?? null;
  }

  public async getRunForOwner(
    owner: string,
    id: AIExecutionRunId,
  ): Promise<AIExecutionRunView | null> {
    const view = this.runs.get(id);
    const conversation = view ? this.conversations.get(view.run.conversationId) : undefined;
    return conversation?.owner === owner ? (view ?? null) : null;
  }

  public async startRun(id: AIExecutionRunId, startedAt: Date): Promise<AIExecutionRun | null> {
    const view = this.runs.get(id);
    if (!view || view.run.status !== 'pending') return null;
    const run = startAIExecutionRun(view.run, startedAt);
    this.runs.set(id, { run });
    await this.appendRunEvent(
      id,
      {
        type: 'run.started',
        data: { provider: run.provider, model: run.model, startedAt: startedAt.toISOString() },
      },
      startedAt,
    );
    return run;
  }

  public async appendRunEvent(id: AIExecutionRunId, event: YaraRunEvent, createdAt: Date) {
    const events = this.events.get(id) ?? [];
    const stored = { runId: id, sequence: events.length + 1, event, createdAt };
    events.push(stored);
    this.events.set(id, events);
    return stored;
  }

  public async completeRunWithAssistantMessage(input: {
    readonly runId: AIExecutionRunId;
    readonly messageId: MessageId;
    readonly content: string;
    readonly finishedAt: Date;
    readonly providerResponseId?: string;
    readonly usage?: ModelUsage;
  }): Promise<AIExecutionRunView | null> {
    const view = this.runs.get(input.runId);
    if (!view || view.run.status !== 'running') return null;
    const stored = this.conversations.get(view.run.conversationId);
    if (!stored) return null;
    const message = createConversationMessage({
      id: input.messageId,
      conversationId: view.run.conversationId,
      sequence: stored.value.messages.length + 1,
      role: 'assistant',
      content: input.content,
      createdAt: input.finishedAt,
    });
    stored.value = appendCommittedMessage(stored.value, message);
    const run = completeAIExecutionRun(view.run, input);
    this.runs.set(input.runId, { run, assistantMessage: message });
    await this.appendRunEvent(
      input.runId,
      {
        type: 'message.completed',
        data: { messageId: message.id, createdAt: input.finishedAt.toISOString() },
      },
      input.finishedAt,
    );
    await this.appendRunEvent(
      input.runId,
      { type: 'run.completed', data: { completedAt: input.finishedAt.toISOString() } },
      input.finishedAt,
    );
    return { run, assistantMessage: message };
  }

  public async failRun(id: AIExecutionRunId, failure: AIExecutionFailure, finishedAt: Date) {
    const view = this.runs.get(id);
    if (!view || view.run.status !== 'running') return null;
    const run = failAIExecutionRun(view.run, failure, finishedAt);
    this.runs.set(id, { run });
    await this.appendRunEvent(
      id,
      { type: 'run.failed', data: { ...failure, failedAt: finishedAt.toISOString() } },
      finishedAt,
    );
    return run;
  }

  public async cancelRunForOwner(owner: string, id: AIExecutionRunId, finishedAt: Date) {
    const view = await this.getRunForOwner(owner, id);
    if (!view) return null;
    if (view.run.status !== 'pending' && view.run.status !== 'running') return view;
    const run = cancelAIExecutionRun(view.run, finishedAt);
    this.runs.set(id, { run });
    await this.appendRunEvent(
      id,
      { type: 'run.cancelled', data: { cancelledAt: finishedAt.toISOString() } },
      finishedAt,
    );
    return { run };
  }

  public async listRunEventsForOwner(input: {
    readonly ownerRef: string;
    readonly runId: AIExecutionRunId;
    readonly afterSequence: number;
    readonly limit: number;
  }) {
    const owned = await this.getRunForOwner(input.ownerRef, input.runId);
    if (!owned) return [];
    return (this.events.get(input.runId) ?? [])
      .filter((event) => event.sequence > input.afterSequence)
      .slice(0, input.limit);
  }
}

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 10, 6, 10, 0, tick++));
}

const observer = { record() {} };

describe('Stage 2 conversation orchestration', () => {
  it('lists only meaningful owned conversations with bounded display summaries', async () => {
    const persistence = new MemoryYaraPersistence();
    const application = new ConversationApplicationService(
      persistence,
      { provider: 'test', model: 'test-model' },
      clock(),
    );
    await application.create('owner:1');
    const first = await application.create('owner:1');
    await application.send('owner:1', first.id, `A first question ${'with detail '.repeat(12)}`);
    await application.send('owner:1', first.id, `A later message ${'with context '.repeat(16)}`);
    const otherOwner = await application.create('owner:2');
    await application.send('owner:2', otherOwner.id, 'Private to another owner');

    const summaries = await application.list('owner:1', 20);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: first.id,
      messageCount: 2,
      lastMessageRole: 'user',
    });
    expect(summaries[0]?.title.endsWith('…')).toBe(true);
    expect(summaries[0]?.title.length).toBeLessThanOrEqual(88);
    expect(summaries[0]?.preview.length).toBeLessThanOrEqual(140);
  });

  it('rejects an unbounded conversation-history request', async () => {
    const application = new ConversationApplicationService(
      new MemoryYaraPersistence(),
      { provider: 'test', model: 'test-model' },
      clock(),
    );
    await expect(application.list('owner:1', 51)).rejects.toThrow(
      'Conversation history limit must be between 1 and 50.',
    );
  });

  it('commits an assistant message only after a successful provider completion', async () => {
    const persistence = new MemoryYaraPersistence();
    const application = new ConversationApplicationService(
      persistence,
      { provider: 'test', model: 'test-model' },
      clock(),
    );
    const conversation = await application.create('owner:1');
    const receipt = await application.send('owner:1', conversation.id, 'Why does this feel open?');
    const runtime: AgentRuntimePort = {
      async *execute() {
        yield { type: 'text.delta', delta: 'Wide reverb' };
        yield { type: 'text.delta', delta: ' leaves space.' };
        yield { type: 'completed', providerResponseId: 'replaceable-provider-id' };
      },
    };
    await new ConversationExecutionService(persistence, runtime, observer, clock()).execute(
      receipt.runId,
    );

    const durable = await application.get('owner:1', conversation.id);
    expect(durable.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(durable.messages[1]?.content).toBe('Wide reverb leaves space.');
    expect((await application.getRun('owner:1', receipt.runId)).run.status).toBe('completed');
    expect((persistence.events.get(receipt.runId) ?? []).map(({ event }) => event.type)).toEqual([
      'run.started',
      'message.delta',
      'message.completed',
      'run.completed',
    ]);
  });

  it('records a safe failed run without fabricating an assistant message', async () => {
    const persistence = new MemoryYaraPersistence();
    const application = new ConversationApplicationService(
      persistence,
      { provider: 'test', model: 'test-model' },
      clock(),
    );
    const conversation = await application.create('owner:1');
    const receipt = await application.send('owner:1', conversation.id, 'Hello?');
    const runtime: AgentRuntimePort = {
      async *execute() {
        yield* [];
        throw new ModelProviderError('timeout', 'raw provider secret', true);
      },
    };
    await new ConversationExecutionService(persistence, runtime, observer, clock()).execute(
      receipt.runId,
    );

    const durable = await application.get('owner:1', conversation.id);
    const failed = await application.getRun('owner:1', receipt.runId);
    expect(durable.messages).toHaveLength(1);
    expect(failed.assistantMessage).toBeUndefined();
    expect(failed.run).toMatchObject({
      status: 'failed',
      failure: { code: 'provider_timeout', message: 'Yara took too long to respond.' },
    });
    expect(JSON.stringify(failed)).not.toContain('raw provider secret');
  });
});
