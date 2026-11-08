import {
  aiExecutionRunId,
  createAIExecutionRun,
  type AIExecutionFailure,
  type AIExecutionRun,
  type AIExecutionRunId,
  type ModelUsage,
} from '@yara/ai-runtime';
import {
  ConversationNotFoundError,
  type AIExecutionRunView,
  type StoredYaraRunEvent,
  type YaraInteractionPersistencePort,
  type YaraRunEvent,
} from '@yara/application';
import {
  conversationId,
  createConversationMessage,
  createYaraConversation,
  type ConversationId,
  type ConversationMessage,
  type MessageId,
  type YaraConversation,
} from '@yara/domain-yara-interaction';
import type { Kysely, Transaction } from 'kysely';

import type { YaraAIExecutionRunTable, YaraDatabase } from './database-schema.js';

function domainRun(row: YaraAIExecutionRunTable): AIExecutionRun {
  return createAIExecutionRun({
    id: aiExecutionRunId(row.id),
    conversationId: row.conversation_id,
    triggerMessageId: row.trigger_message_id,
    status: row.status,
    provider: row.provider,
    model: row.model,
    createdAt: row.created_at,
    ...(row.provider_response_id ? { providerResponseId: row.provider_response_id } : {}),
    ...(row.usage ? { usage: row.usage } : {}),
    ...(row.failure ? { failure: row.failure } : {}),
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
  });
}

function domainMessage(row: {
  readonly id: string;
  readonly conversation_id: string;
  readonly sequence: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly created_at: Date;
}): ConversationMessage {
  return createConversationMessage({
    id: row.id,
    conversationId: row.conversation_id,
    sequence: row.sequence,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  });
}

async function nextMessageSequence(
  transaction: Transaction<YaraDatabase>,
  id: ConversationId,
): Promise<number> {
  const row = await transaction
    .selectFrom('yara_interaction.conversation_messages')
    .select(({ fn }) => fn.max<number>('sequence').as('maximum'))
    .where('conversation_id', '=', id)
    .executeTakeFirst();
  return Number(row?.maximum ?? 0) + 1;
}

async function appendEvent(
  transaction: Transaction<YaraDatabase>,
  runId: AIExecutionRunId,
  event: YaraRunEvent,
  createdAt: Date,
): Promise<StoredYaraRunEvent> {
  const row = await transaction
    .selectFrom('yara_interaction.ai_execution_run_events')
    .select(({ fn }) => fn.max<number>('sequence').as('maximum'))
    .where('run_id', '=', runId)
    .executeTakeFirst();
  const sequence = Number(row?.maximum ?? 0) + 1;
  await transaction
    .insertInto('yara_interaction.ai_execution_run_events')
    .values({
      run_id: runId,
      sequence,
      event_type: event.type,
      payload: event,
      created_at: createdAt,
    })
    .execute();
  return { runId, sequence, event, createdAt };
}

/** Yara Interaction-owned persistence adapter; streaming deltas remain run events, not messages. */
export class PostgresYaraInteractionAdapter implements YaraInteractionPersistencePort {
  public constructor(private readonly database: Kysely<YaraDatabase>) {}

  public async createConversation(ownerRef: string, conversation: YaraConversation): Promise<void> {
    await this.database
      .insertInto('yara_interaction.conversations')
      .values({
        id: conversation.id,
        owner_ref: ownerRef,
        status: conversation.status,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
      })
      .execute();
  }

  public getConversation(id: ConversationId): Promise<YaraConversation | null> {
    return this.loadConversation(id);
  }

  public async getConversationForOwner(
    ownerRef: string,
    id: ConversationId,
  ): Promise<YaraConversation | null> {
    const owned = await this.database
      .selectFrom('yara_interaction.conversations')
      .select('id')
      .where('id', '=', id)
      .where('owner_ref', '=', ownerRef)
      .executeTakeFirst();
    return owned ? this.loadConversation(id) : null;
  }

  public async listMeaningfulConversationsForOwner(
    ownerRef: string,
    limit: number,
  ): Promise<readonly YaraConversation[]> {
    const rows = await this.database
      .selectFrom('yara_interaction.conversations as conversation')
      .select('conversation.id')
      .where('conversation.owner_ref', '=', ownerRef)
      .where(({ exists, selectFrom }) =>
        exists(
          selectFrom('yara_interaction.conversation_messages as message')
            .select('message.id')
            .whereRef('message.conversation_id', '=', 'conversation.id')
            .where('message.role', '=', 'user'),
        ),
      )
      .orderBy('conversation.updated_at', 'desc')
      .orderBy('conversation.id', 'desc')
      .limit(limit)
      .execute();
    const conversations = await Promise.all(
      rows.map(({ id }) => this.loadConversation(conversationId(id))),
    );
    return conversations.filter((value): value is YaraConversation => value !== null);
  }

  private async loadConversation(id: ConversationId): Promise<YaraConversation | null> {
    const row = await this.database
      .selectFrom('yara_interaction.conversations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    const messages = await this.database
      .selectFrom('yara_interaction.conversation_messages')
      .selectAll()
      .where('conversation_id', '=', id)
      .orderBy('sequence')
      .execute();
    return createYaraConversation({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: messages.map(domainMessage),
    });
  }

  public async acceptUserMessageAndRun(input: {
    readonly ownerRef: string;
    readonly messageId: MessageId;
    readonly conversationId: ConversationId;
    readonly content: string;
    readonly createdAt: Date;
    readonly run: AIExecutionRun;
  }): Promise<{ readonly message: ConversationMessage; readonly run: AIExecutionRun }> {
    return this.database.transaction().execute(async (transaction) => {
      const conversation = await transaction
        .selectFrom('yara_interaction.conversations')
        .selectAll()
        .where('id', '=', input.conversationId)
        .where('owner_ref', '=', input.ownerRef)
        .where('status', '=', 'active')
        .forUpdate()
        .executeTakeFirst();
      if (!conversation) throw new ConversationNotFoundError('Conversation was not found.');
      const sequence = await nextMessageSequence(transaction, input.conversationId);
      const message = createConversationMessage({
        id: input.messageId,
        conversationId: input.conversationId,
        sequence,
        role: 'user',
        content: input.content,
        createdAt: input.createdAt,
      });
      await transaction
        .insertInto('yara_interaction.conversation_messages')
        .values({
          id: message.id,
          conversation_id: message.conversationId,
          sequence: message.sequence,
          role: message.role,
          status: 'committed',
          content: message.content,
          created_at: message.createdAt,
        })
        .execute();
      await transaction
        .insertInto('yara_interaction.ai_execution_runs')
        .values({
          id: input.run.id,
          conversation_id: input.conversationId,
          trigger_message_id: message.id,
          assistant_message_id: null,
          status: input.run.status,
          provider: input.run.provider,
          model: input.run.model,
          provider_response_id: null,
          usage: null,
          failure: null,
          created_at: input.run.createdAt,
          started_at: null,
          finished_at: null,
          updated_at: input.run.createdAt,
        })
        .execute();
      await transaction
        .updateTable('yara_interaction.conversations')
        .set({ updated_at: input.createdAt })
        .where('id', '=', input.conversationId)
        .execute();
      return { message, run: input.run };
    });
  }

  public getRun(runId: AIExecutionRunId): Promise<AIExecutionRunView | null> {
    return this.loadRun(runId);
  }

  public async getRunForOwner(
    ownerRef: string,
    runId: AIExecutionRunId,
  ): Promise<AIExecutionRunView | null> {
    const row = await this.database
      .selectFrom('yara_interaction.ai_execution_runs as run')
      .innerJoin(
        'yara_interaction.conversations as conversation',
        'conversation.id',
        'run.conversation_id',
      )
      .select('run.id')
      .where('run.id', '=', runId)
      .where('conversation.owner_ref', '=', ownerRef)
      .executeTakeFirst();
    return row ? this.loadRun(runId) : null;
  }

  private async loadRun(runId: AIExecutionRunId): Promise<AIExecutionRunView | null> {
    const row = await this.database
      .selectFrom('yara_interaction.ai_execution_runs')
      .selectAll()
      .where('id', '=', runId)
      .executeTakeFirst();
    if (!row) return null;
    const assistant = row.assistant_message_id
      ? await this.database
          .selectFrom('yara_interaction.conversation_messages')
          .selectAll()
          .where('id', '=', row.assistant_message_id)
          .executeTakeFirst()
      : undefined;
    return {
      run: domainRun(row),
      ...(assistant ? { assistantMessage: domainMessage(assistant) } : {}),
    };
  }

  public async startRun(runId: AIExecutionRunId, startedAt: Date): Promise<AIExecutionRun | null> {
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('yara_interaction.ai_execution_runs')
        .selectAll()
        .where('id', '=', runId)
        .forUpdate()
        .executeTakeFirst();
      if (!row || row.status !== 'pending') return null;
      await transaction
        .updateTable('yara_interaction.ai_execution_runs')
        .set({ status: 'running', started_at: startedAt, updated_at: startedAt })
        .where('id', '=', runId)
        .execute();
      await appendEvent(
        transaction,
        runId,
        {
          type: 'run.started',
          data: { provider: row.provider, model: row.model, startedAt: startedAt.toISOString() },
        },
        startedAt,
      );
      return domainRun({ ...row, status: 'running', started_at: startedAt, updated_at: startedAt });
    });
  }

  public async appendRunEvent(
    runId: AIExecutionRunId,
    event: YaraRunEvent,
    createdAt: Date,
  ): Promise<StoredYaraRunEvent | null> {
    return this.database.transaction().execute(async (transaction) => {
      const run = await transaction
        .selectFrom('yara_interaction.ai_execution_runs')
        .select(['id', 'status'])
        .where('id', '=', runId)
        .forUpdate()
        .executeTakeFirst();
      if (!run || run.status !== 'running') return null;
      return appendEvent(transaction, runId, event, createdAt);
    });
  }

  public async completeRunWithAssistantMessage(input: {
    readonly runId: AIExecutionRunId;
    readonly messageId: MessageId;
    readonly content: string;
    readonly finishedAt: Date;
    readonly providerResponseId?: string;
    readonly usage?: ModelUsage;
  }): Promise<AIExecutionRunView | null> {
    return this.database.transaction().execute(async (transaction) => {
      const run = await transaction
        .selectFrom('yara_interaction.ai_execution_runs')
        .selectAll()
        .where('id', '=', input.runId)
        .forUpdate()
        .executeTakeFirst();
      if (!run || run.status !== 'running') return null;
      await transaction
        .selectFrom('yara_interaction.conversations')
        .select('id')
        .where('id', '=', run.conversation_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const sequence = await nextMessageSequence(transaction, conversationId(run.conversation_id));
      const assistantMessage = createConversationMessage({
        id: input.messageId,
        conversationId: run.conversation_id,
        sequence,
        role: 'assistant',
        content: input.content,
        createdAt: input.finishedAt,
      });
      await transaction
        .insertInto('yara_interaction.conversation_messages')
        .values({
          id: assistantMessage.id,
          conversation_id: assistantMessage.conversationId,
          sequence,
          role: 'assistant',
          status: 'committed',
          content: assistantMessage.content,
          created_at: assistantMessage.createdAt,
        })
        .execute();
      await transaction
        .updateTable('yara_interaction.ai_execution_runs')
        .set({
          status: 'completed',
          assistant_message_id: assistantMessage.id,
          provider_response_id: input.providerResponseId ?? null,
          usage: input.usage ?? null,
          finished_at: input.finishedAt,
          updated_at: input.finishedAt,
        })
        .where('id', '=', input.runId)
        .execute();
      await transaction
        .updateTable('yara_interaction.conversations')
        .set({ updated_at: input.finishedAt })
        .where('id', '=', run.conversation_id)
        .execute();
      await appendEvent(
        transaction,
        input.runId,
        {
          type: 'message.completed',
          data: { messageId: assistantMessage.id, createdAt: input.finishedAt.toISOString() },
        },
        input.finishedAt,
      );
      await appendEvent(
        transaction,
        input.runId,
        {
          type: 'run.completed',
          data: {
            completedAt: input.finishedAt.toISOString(),
            ...(input.usage ? { usage: input.usage } : {}),
          },
        },
        input.finishedAt,
      );
      const persisted = {
        ...run,
        status: 'completed' as const,
        assistant_message_id: assistantMessage.id,
        provider_response_id: input.providerResponseId ?? null,
        usage: input.usage ?? null,
        finished_at: input.finishedAt,
        updated_at: input.finishedAt,
      };
      return { run: domainRun(persisted), assistantMessage };
    });
  }

  public async failRun(
    runId: AIExecutionRunId,
    failure: AIExecutionFailure,
    finishedAt: Date,
  ): Promise<AIExecutionRun | null> {
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('yara_interaction.ai_execution_runs')
        .selectAll()
        .where('id', '=', runId)
        .forUpdate()
        .executeTakeFirst();
      if (!row || row.status !== 'running') return null;
      await transaction
        .updateTable('yara_interaction.ai_execution_runs')
        .set({ status: 'failed', failure, finished_at: finishedAt, updated_at: finishedAt })
        .where('id', '=', runId)
        .execute();
      await appendEvent(
        transaction,
        runId,
        {
          type: 'run.failed',
          data: {
            code: failure.code,
            message: failure.message,
            failedAt: finishedAt.toISOString(),
          },
        },
        finishedAt,
      );
      return domainRun({
        ...row,
        status: 'failed',
        failure,
        finished_at: finishedAt,
        updated_at: finishedAt,
      });
    });
  }

  public async cancelRunForOwner(
    ownerRef: string,
    runId: AIExecutionRunId,
    finishedAt: Date,
  ): Promise<AIExecutionRunView | null> {
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('yara_interaction.ai_execution_runs as run')
        .innerJoin(
          'yara_interaction.conversations as conversation',
          'conversation.id',
          'run.conversation_id',
        )
        .selectAll('run')
        .where('run.id', '=', runId)
        .where('conversation.owner_ref', '=', ownerRef)
        .forUpdate('run')
        .executeTakeFirst();
      if (!row) return null;
      if (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled') {
        return this.loadRun(runId);
      }
      await transaction
        .updateTable('yara_interaction.ai_execution_runs')
        .set({ status: 'cancelled', finished_at: finishedAt, updated_at: finishedAt })
        .where('id', '=', runId)
        .execute();
      await appendEvent(
        transaction,
        runId,
        { type: 'run.cancelled', data: { cancelledAt: finishedAt.toISOString() } },
        finishedAt,
      );
      return {
        run: domainRun({
          ...row,
          status: 'cancelled',
          finished_at: finishedAt,
          updated_at: finishedAt,
        }),
      };
    });
  }

  public async listRunEventsForOwner(input: {
    readonly ownerRef: string;
    readonly runId: AIExecutionRunId;
    readonly afterSequence: number;
    readonly limit: number;
  }): Promise<readonly StoredYaraRunEvent[]> {
    const rows = await this.database
      .selectFrom('yara_interaction.ai_execution_run_events as event')
      .innerJoin('yara_interaction.ai_execution_runs as run', 'run.id', 'event.run_id')
      .innerJoin(
        'yara_interaction.conversations as conversation',
        'conversation.id',
        'run.conversation_id',
      )
      .selectAll('event')
      .where('event.run_id', '=', input.runId)
      .where('conversation.owner_ref', '=', input.ownerRef)
      .where('event.sequence', '>', input.afterSequence)
      .orderBy('event.sequence')
      .limit(input.limit)
      .execute();
    return rows.map((row) => ({
      runId: aiExecutionRunId(row.run_id),
      sequence: row.sequence,
      event: row.payload,
      createdAt: row.created_at,
    }));
  }
}
