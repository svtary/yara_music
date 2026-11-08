import { randomUUID } from 'node:crypto';

import {
  aiExecutionRunId,
  createAIExecutionRun,
  isTerminalAIExecutionRun,
  ModelProviderError,
  type AgentRuntimePort,
  type AIExecutionFailure,
  type AIExecutionRunId,
  type ModelProviderEvent,
} from '@yara/ai-runtime';
import {
  conversationId,
  createYaraConversation,
  messageId,
  YaraInteractionInvariantError,
  type ConversationId,
  type MessageId,
  type YaraConversation,
} from '@yara/domain-yara-interaction';

import {
  buildBoundedConversationContext,
  stageTwoConversationContextPolicy,
  stageTwoSystemInstruction,
} from './conversation-context.js';
import type {
  AIExecutionObserverPort,
  AIExecutionRunView,
  StoredYaraRunEvent,
  YaraInteractionPersistencePort,
  YaraConversationSummaryView,
} from './yara-interaction-port.js';

export class ConversationNotFoundError extends Error {}
export class AIExecutionRunNotFoundError extends Error {}
export class ConversationInputError extends Error {}

function newConversationId(): ConversationId {
  return conversationId(`conversation:yara:${randomUUID()}`);
}

function newMessageId(): MessageId {
  return messageId(`message:yara:${randomUUID()}`);
}

function newRunId(): AIExecutionRunId {
  return aiExecutionRunId(`ai-run:yara:${randomUUID()}`);
}

function normalizeMessageContent(value: string): string {
  if (typeof value !== 'string') {
    throw new ConversationInputError('Message content must be between 1 and 4,000 characters.');
  }
  const content = value.trim();
  if (!content || content.length > 4000 || content.includes('\u0000')) {
    throw new ConversationInputError('Message content must be between 1 and 4,000 characters.');
  }
  return content;
}

function boundedDisplayText(value: string, maximum: number): string {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function parseConversationId(value: string): ConversationId {
  try {
    return conversationId(value);
  } catch (error) {
    if (error instanceof YaraInteractionInvariantError) {
      throw new ConversationInputError('Conversation identity is invalid.');
    }
    throw error;
  }
}

function parseRunId(value: string): AIExecutionRunId {
  try {
    return aiExecutionRunId(value);
  } catch {
    throw new ConversationInputError('AI execution run identity is invalid.');
  }
}

function mapFailure(error: unknown): AIExecutionFailure {
  if (error instanceof ModelProviderError) {
    switch (error.code) {
      case 'unavailable':
        return { code: 'provider_unavailable', message: 'Yara is temporarily unavailable.' };
      case 'timeout':
        return { code: 'provider_timeout', message: 'Yara took too long to respond.' };
      case 'rate_limited':
        return { code: 'provider_rate_limited', message: 'Yara is receiving too many requests.' };
      case 'invalid_response':
        return {
          code: 'invalid_provider_response',
          message: 'Yara received an invalid model response.',
        };
      case 'aborted':
        return { code: 'stream_interrupted', message: 'The model stream was interrupted.' };
      default:
        return { code: 'model_failure', message: 'Yara could not complete this response.' };
    }
  }
  return { code: 'model_failure', message: 'Yara could not complete this response.' };
}

export class ConversationApplicationService {
  public constructor(
    private readonly persistence: YaraInteractionPersistencePort,
    private readonly provider: { readonly provider: string; readonly model: string },
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async create(ownerRef: string): Promise<YaraConversation> {
    const createdAt = this.now();
    const conversation = createYaraConversation({ id: newConversationId(), createdAt });
    await this.persistence.createConversation(ownerRef, conversation);
    return conversation;
  }

  public async get(ownerRef: string, rawConversationId: string): Promise<YaraConversation> {
    const conversation = await this.persistence.getConversationForOwner(
      ownerRef,
      parseConversationId(rawConversationId),
    );
    if (!conversation) throw new ConversationNotFoundError('Conversation was not found.');
    return conversation;
  }

  public async list(ownerRef: string, limit = 20): Promise<readonly YaraConversationSummaryView[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      throw new ConversationInputError('Conversation history limit must be between 1 and 50.');
    }
    const conversations = await this.persistence.listMeaningfulConversationsForOwner(
      ownerRef,
      limit,
    );
    return conversations.flatMap((conversation) => {
      const firstUserMessage = conversation.messages.find((message) => message.role === 'user');
      const lastMessage = conversation.messages.at(-1);
      if (!firstUserMessage || !lastMessage) return [];
      return [
        {
          id: conversation.id,
          updatedAt: conversation.updatedAt,
          title: boundedDisplayText(firstUserMessage.content, 88),
          preview: boundedDisplayText(lastMessage.content, 140),
          messageCount: conversation.messages.length,
          lastMessageRole: lastMessage.role,
        },
      ];
    });
  }

  public async send(
    ownerRef: string,
    rawConversationId: string,
    rawContent: string,
  ): Promise<{
    readonly conversationId: ConversationId;
    readonly messageId: MessageId;
    readonly runId: AIExecutionRunId;
  }> {
    const id = parseConversationId(rawConversationId);
    const content = normalizeMessageContent(rawContent);
    const createdAt = this.now();
    const userMessageId = newMessageId();
    const runId = newRunId();
    const run = createAIExecutionRun({
      id: runId,
      conversationId: id,
      triggerMessageId: userMessageId,
      status: 'pending',
      provider: this.provider.provider,
      model: this.provider.model,
      createdAt,
    });

    try {
      await this.persistence.acceptUserMessageAndRun({
        ownerRef,
        messageId: userMessageId,
        conversationId: id,
        content,
        createdAt,
        run,
      });
    } catch (error) {
      if (error instanceof ConversationNotFoundError) throw error;
      throw error;
    }
    return { conversationId: id, messageId: userMessageId, runId };
  }

  public async getRun(ownerRef: string, rawRunId: string): Promise<AIExecutionRunView> {
    const view = await this.persistence.getRunForOwner(ownerRef, parseRunId(rawRunId));
    if (!view) throw new AIExecutionRunNotFoundError('AI execution run was not found.');
    return view;
  }

  public async listEvents(
    ownerRef: string,
    rawRunId: string,
    afterSequence: number,
    limit = 128,
  ): Promise<readonly StoredYaraRunEvent[]> {
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
      throw new ConversationInputError('The SSE cursor must be a non-negative integer.');
    }
    const runId = parseRunId(rawRunId);
    const view = await this.persistence.getRunForOwner(ownerRef, runId);
    if (!view) throw new AIExecutionRunNotFoundError('AI execution run was not found.');
    return this.persistence.listRunEventsForOwner({
      ownerRef,
      runId,
      afterSequence,
      limit: Math.min(Math.max(limit, 1), 128),
    });
  }

  public async cancel(ownerRef: string, rawRunId: string): Promise<AIExecutionRunView> {
    const view = await this.persistence.cancelRunForOwner(
      ownerRef,
      parseRunId(rawRunId),
      this.now(),
    );
    if (!view) throw new AIExecutionRunNotFoundError('AI execution run was not found.');
    return view;
  }
}

export class ConversationExecutionService {
  private readonly activeRuns = new Map<string, AbortController>();

  public constructor(
    private readonly persistence: YaraInteractionPersistencePort,
    private readonly runtime: AgentRuntimePort,
    private readonly observer: AIExecutionObserverPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public abort(runId: AIExecutionRunId): void {
    this.activeRuns.get(runId)?.abort();
  }

  public async execute(runId: AIExecutionRunId): Promise<void> {
    const startedAt = this.now();
    const run = await this.persistence.startRun(runId, startedAt);
    if (!run) return;
    const conversation = await this.persistence.getConversation(conversationId(run.conversationId));
    if (!conversation) {
      await this.persistence.failRun(
        runId,
        { code: 'model_failure', message: 'The conversation is no longer available.' },
        this.now(),
      );
      return;
    }

    this.observer.record({
      conversationId: run.conversationId,
      runId,
      provider: run.provider,
      model: run.model,
      status: 'running',
    });

    const controller = new AbortController();
    this.activeRuns.set(runId, controller);
    let content = '';
    let pendingDelta = '';
    let completion: Extract<ModelProviderEvent, { readonly type: 'completed' }> | undefined;

    const flushDelta = async (): Promise<void> => {
      if (!pendingDelta) return;
      const delta = pendingDelta;
      pendingDelta = '';
      await this.persistence.appendRunEvent(
        runId,
        { type: 'message.delta', data: { delta } },
        this.now(),
      );
    };

    try {
      const messages = buildBoundedConversationContext(conversation.messages);
      for await (const event of this.runtime.execute({
        runId,
        model: run.model,
        systemInstruction: stageTwoSystemInstruction,
        messages,
        maxOutputCharacters: stageTwoConversationContextPolicy.maximumOutputCharacters,
        signal: controller.signal,
      })) {
        if (event.type === 'text.delta') {
          if (!event.delta || event.delta.includes('\u0000')) {
            throw new ModelProviderError('invalid_response', 'Invalid text delta.', false);
          }
          content += event.delta;
          pendingDelta += event.delta;
          if (content.length > stageTwoConversationContextPolicy.maximumOutputCharacters) {
            throw new ModelProviderError(
              'invalid_response',
              'Model output exceeded its budget.',
              false,
            );
          }
          if (pendingDelta.length >= 48 || /[.!?\n。！？]$/u.test(pendingDelta)) await flushDelta();
        } else {
          completion = event;
        }
      }
      await flushDelta();
      if (!completion || !content.trim()) {
        throw new ModelProviderError(
          'invalid_response',
          'Model stream ended without completion.',
          false,
        );
      }

      const finishedAt = this.now();
      const completed = await this.persistence.completeRunWithAssistantMessage({
        runId,
        messageId: newMessageId(),
        content: content.trim(),
        finishedAt,
        ...(completion.providerResponseId
          ? { providerResponseId: completion.providerResponseId }
          : {}),
        ...(completion.usage ? { usage: completion.usage } : {}),
      });
      if (completed) {
        this.observer.record({
          conversationId: run.conversationId,
          runId,
          provider: run.provider,
          model: run.model,
          status: 'completed',
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        });
      }
    } catch (error) {
      const current = await this.persistence.getRun(runId);
      if (current && isTerminalAIExecutionRun(current.run.status)) {
        if (current.run.status === 'cancelled') {
          this.observer.record({
            conversationId: run.conversationId,
            runId,
            provider: run.provider,
            model: run.model,
            status: 'cancelled',
            durationMs: this.now().getTime() - startedAt.getTime(),
          });
        }
        return;
      }
      const failure = mapFailure(error);
      const finishedAt = this.now();
      await this.persistence.failRun(runId, failure, finishedAt);
      this.observer.record({
        conversationId: run.conversationId,
        runId,
        provider: run.provider,
        model: run.model,
        status: 'failed',
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        failureCode: failure.code,
      });
    } finally {
      this.activeRuns.delete(runId);
    }
  }
}
