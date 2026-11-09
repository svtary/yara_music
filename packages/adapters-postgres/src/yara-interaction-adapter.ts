import {
  aiExecutionRunId,
  createAIExecutionRun,
  type AIExecutionFailure,
  type AIExecutionRun,
  type AIExecutionRunId,
  type ModelUsage,
} from '@yara/ai-runtime';
import {
  ActiveAIExecutionRunConflictError,
  ConversationNotFoundError,
  IdempotencyConflictError,
  type ClaimedAIExecutionJob,
  type ConversationCommandReceipt,
  type AIExecutionRunView,
  type StoredYaraRunEvent,
  type YaraInteractionPersistencePort,
  type YaraRunEvent,
} from '@yara/application';
import {
  conversationId,
  createConversationMessage,
  createYaraConversation,
  messageId,
  type ConversationId,
  type ConversationMessage,
  type MessageId,
  type YaraConversation,
} from '@yara/domain-yara-interaction';
import { sql, type Kysely, type Transaction } from 'kysely';

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

async function lockCommandIdentity(
  transaction: Transaction<YaraDatabase>,
  ownerRef: string,
  scope: 'start_conversation' | 'send_message',
  key: string,
): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`${ownerRef}:${scope}:${key}`}, 0))`.execute(
    transaction,
  );
}

async function existingCommandReceipt(
  transaction: Transaction<YaraDatabase>,
  input: {
    readonly ownerRef: string;
    readonly scope: 'start_conversation' | 'send_message';
    readonly idempotencyKey: string;
    readonly semanticFingerprint: string;
  },
): Promise<ConversationCommandReceipt | null> {
  const row = await transaction
    .selectFrom('yara_interaction.command_idempotency')
    .selectAll()
    .where('owner_ref', '=', input.ownerRef)
    .where('command_scope', '=', input.scope)
    .where('idempotency_key', '=', input.idempotencyKey)
    .executeTakeFirst();
  if (!row) return null;
  if (row.semantic_fingerprint !== input.semanticFingerprint) {
    throw new IdempotencyConflictError(
      'This idempotency key is already bound to a different command.',
    );
  }
  return {
    conversationId: conversationId(row.conversation_id),
    messageId: messageId(row.message_id),
    runId: aiExecutionRunId(row.run_id),
  };
}

async function insertRunAndJob(
  transaction: Transaction<YaraDatabase>,
  run: AIExecutionRun,
  createdAt: Date,
): Promise<void> {
  await transaction
    .insertInto('yara_interaction.ai_execution_runs')
    .values({
      id: run.id,
      conversation_id: run.conversationId,
      trigger_message_id: run.triggerMessageId,
      assistant_message_id: null,
      status: run.status,
      provider: run.provider,
      model: run.model,
      provider_response_id: null,
      usage: null,
      failure: null,
      created_at: run.createdAt,
      started_at: null,
      finished_at: null,
      updated_at: run.createdAt,
    })
    .execute();
  await transaction
    .insertInto('yara_interaction.ai_execution_jobs')
    .values({
      run_id: run.id,
      status: 'queued',
      attempt: 0,
      lease_owner: null,
      lease_expires_at: null,
      last_error: null,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .execute();
}

async function insertCommandRecord(
  transaction: Transaction<YaraDatabase>,
  input: {
    readonly ownerRef: string;
    readonly scope: 'start_conversation' | 'send_message';
    readonly idempotencyKey: string;
    readonly semanticFingerprint: string;
    readonly receipt: ConversationCommandReceipt;
    readonly createdAt: Date;
  },
): Promise<void> {
  await transaction
    .insertInto('yara_interaction.command_idempotency')
    .values({
      owner_ref: input.ownerRef,
      command_scope: input.scope,
      idempotency_key: input.idempotencyKey,
      semantic_fingerprint: input.semanticFingerprint,
      conversation_id: input.receipt.conversationId,
      message_id: input.receipt.messageId,
      run_id: input.receipt.runId,
      created_at: input.createdAt,
    })
    .execute();
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

  public async getConversationViewForOwner(ownerRef: string, id: ConversationId) {
    const conversation = await this.getConversationForOwner(ownerRef, id);
    if (!conversation) return null;
    const active = await this.database
      .selectFrom('yara_interaction.ai_execution_runs')
      .selectAll()
      .where('conversation_id', '=', id)
      .where('status', 'in', ['pending', 'running'])
      .executeTakeFirst();
    return {
      conversation,
      ...(active ? { activeRun: domainRun(active) } : {}),
    };
  }

  public async listConversationSummariesForOwner(ownerRef: string, limit: number) {
    const result = await sql<{
      id: string;
      updated_at: Date;
      title: string;
      preview: string;
      message_count: number;
      last_message_role: 'user' | 'assistant';
      active_run_id: string | null;
      active_run_status: 'pending' | 'running' | null;
    }>`
      select
        conversation.id,
        conversation.updated_at,
        case when length(first_user.normalized) > 88
          then rtrim(left(first_user.normalized, 87)) || '…'
          else first_user.normalized end as title,
        case when length(last_message.normalized) > 140
          then rtrim(left(last_message.normalized, 139)) || '…'
          else last_message.normalized end as preview,
        message_count.value::integer as message_count,
        last_message.role as last_message_role,
        active_run.id as active_run_id,
        active_run.status as active_run_status
      from yara_interaction.conversations conversation
      join lateral (
        select regexp_replace(message.content, '\\s+', ' ', 'g') as normalized
        from yara_interaction.conversation_messages message
        where message.conversation_id = conversation.id and message.role = 'user'
        order by message.sequence
        limit 1
      ) first_user on true
      join lateral (
        select message.role, regexp_replace(message.content, '\\s+', ' ', 'g') as normalized
        from yara_interaction.conversation_messages message
        where message.conversation_id = conversation.id
        order by message.sequence desc
        limit 1
      ) last_message on true
      join lateral (
        select count(*) as value
        from yara_interaction.conversation_messages message
        where message.conversation_id = conversation.id
      ) message_count on true
      left join lateral (
        select run.id, run.status
        from yara_interaction.ai_execution_runs run
        where run.conversation_id = conversation.id
          and run.status in ('pending', 'running')
        limit 1
      ) active_run on true
      where conversation.owner_ref = ${ownerRef}
      order by conversation.updated_at desc, conversation.id desc
      limit ${limit}
    `.execute(this.database);
    return result.rows.map((row) => ({
      id: conversationId(row.id),
      updatedAt: row.updated_at,
      title: row.title,
      preview: row.preview,
      messageCount: row.message_count,
      lastMessageRole: row.last_message_role,
      ...(row.active_run_id
        ? {
            activeRunId: aiExecutionRunId(row.active_run_id),
            activeRunStatus: row.active_run_status as 'pending' | 'running',
          }
        : {}),
    }));
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

  public async startConversationWithMessage(input: {
    readonly ownerRef: string;
    readonly idempotencyKey: string;
    readonly semanticFingerprint: string;
    readonly conversation: YaraConversation;
    readonly messageId: MessageId;
    readonly content: string;
    readonly createdAt: Date;
    readonly run: AIExecutionRun;
  }): Promise<ConversationCommandReceipt> {
    return this.database.transaction().execute(async (transaction) => {
      const scope = 'start_conversation' as const;
      await lockCommandIdentity(transaction, input.ownerRef, scope, input.idempotencyKey);
      const existing = await existingCommandReceipt(transaction, {
        ownerRef: input.ownerRef,
        scope,
        idempotencyKey: input.idempotencyKey,
        semanticFingerprint: input.semanticFingerprint,
      });
      if (existing) return existing;

      await transaction
        .insertInto('yara_interaction.conversations')
        .values({
          id: input.conversation.id,
          owner_ref: input.ownerRef,
          status: input.conversation.status,
          created_at: input.conversation.createdAt,
          updated_at: input.createdAt,
        })
        .execute();
      const message = createConversationMessage({
        id: input.messageId,
        conversationId: input.conversation.id,
        sequence: 1,
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
      await insertRunAndJob(transaction, input.run, input.createdAt);
      const receipt = {
        conversationId: input.conversation.id,
        messageId: message.id,
        runId: input.run.id,
      };
      await insertCommandRecord(transaction, {
        ownerRef: input.ownerRef,
        scope,
        idempotencyKey: input.idempotencyKey,
        semanticFingerprint: input.semanticFingerprint,
        receipt,
        createdAt: input.createdAt,
      });
      return receipt;
    });
  }

  public async acceptUserMessageAndRun(input: {
    readonly ownerRef: string;
    readonly idempotencyKey: string;
    readonly semanticFingerprint: string;
    readonly messageId: MessageId;
    readonly conversationId: ConversationId;
    readonly content: string;
    readonly createdAt: Date;
    readonly run: AIExecutionRun;
  }): Promise<ConversationCommandReceipt> {
    return this.database.transaction().execute(async (transaction) => {
      const scope = 'send_message' as const;
      await lockCommandIdentity(transaction, input.ownerRef, scope, input.idempotencyKey);
      const existing = await existingCommandReceipt(transaction, {
        ownerRef: input.ownerRef,
        scope,
        idempotencyKey: input.idempotencyKey,
        semanticFingerprint: input.semanticFingerprint,
      });
      if (existing) return existing;
      const conversation = await transaction
        .selectFrom('yara_interaction.conversations')
        .selectAll()
        .where('id', '=', input.conversationId)
        .where('owner_ref', '=', input.ownerRef)
        .where('status', '=', 'active')
        .forUpdate()
        .executeTakeFirst();
      if (!conversation) throw new ConversationNotFoundError('Conversation was not found.');
      const active = await transaction
        .selectFrom('yara_interaction.ai_execution_runs')
        .select('id')
        .where('conversation_id', '=', input.conversationId)
        .where('status', 'in', ['pending', 'running'])
        .executeTakeFirst();
      if (active) {
        throw new ActiveAIExecutionRunConflictError(
          'This conversation already has an active AI execution run.',
        );
      }
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
      await insertRunAndJob(transaction, input.run, input.createdAt);
      await transaction
        .updateTable('yara_interaction.conversations')
        .set({ updated_at: input.createdAt })
        .where('id', '=', input.conversationId)
        .execute();
      const receipt = {
        conversationId: input.conversationId,
        messageId: message.id,
        runId: input.run.id,
      };
      await insertCommandRecord(transaction, {
        ownerRef: input.ownerRef,
        scope,
        idempotencyKey: input.idempotencyKey,
        semanticFingerprint: input.semanticFingerprint,
        receipt,
        createdAt: input.createdAt,
      });
      return receipt;
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
      await transaction
        .updateTable('yara_interaction.ai_execution_jobs')
        .set({
          status: 'cancelled',
          lease_owner: null,
          lease_expires_at: null,
          updated_at: finishedAt,
        })
        .where('run_id', '=', runId)
        .execute();
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

  public async recoverStaleExecutionJobs(now: Date): Promise<{
    readonly requeued: number;
    readonly reconciliationRequired: number;
    readonly terminalized: number;
  }> {
    return this.database.transaction().execute(async (transaction) => {
      const jobs = await transaction
        .selectFrom('yara_interaction.ai_execution_jobs as job')
        .innerJoin('yara_interaction.ai_execution_runs as run', 'run.id', 'job.run_id')
        .select([
          'job.run_id',
          'run.status as run_status',
          'run.provider',
          'run.model',
          'run.conversation_id',
          'run.trigger_message_id',
          'run.created_at',
          'run.started_at',
          'run.updated_at',
        ])
        .where('job.status', '=', 'claimed')
        .where('job.lease_expires_at', '<=', now)
        .forUpdate('job')
        .skipLocked()
        .execute();
      let requeued = 0;
      let reconciliationRequired = 0;
      let terminalized = 0;
      for (const job of jobs) {
        if (job.run_status === 'pending') {
          await transaction
            .updateTable('yara_interaction.ai_execution_jobs')
            .set({
              status: 'queued',
              lease_owner: null,
              lease_expires_at: null,
              last_error: 'lease_expired_before_provider_execution',
              updated_at: now,
            })
            .where('run_id', '=', job.run_id)
            .execute();
          requeued += 1;
        } else if (job.run_status === 'running') {
          const failure: AIExecutionFailure = {
            code: 'stream_interrupted',
            message: 'Yara could not confirm the provider outcome after worker recovery.',
          };
          await transaction
            .updateTable('yara_interaction.ai_execution_runs')
            .set({ status: 'failed', failure, finished_at: now, updated_at: now })
            .where('id', '=', job.run_id)
            .where('status', '=', 'running')
            .execute();
          await appendEvent(
            transaction,
            aiExecutionRunId(job.run_id),
            {
              type: 'run.failed',
              data: { ...failure, failedAt: now.toISOString() },
            },
            now,
          );
          await transaction
            .updateTable('yara_interaction.ai_execution_jobs')
            .set({
              status: 'reconciliation_required',
              lease_owner: null,
              lease_expires_at: null,
              last_error: 'unknown_provider_outcome_after_lease_expiry',
              updated_at: now,
            })
            .where('run_id', '=', job.run_id)
            .execute();
          reconciliationRequired += 1;
        } else {
          const status =
            job.run_status === 'completed'
              ? 'completed'
              : job.run_status === 'cancelled'
                ? 'cancelled'
                : 'failed';
          await transaction
            .updateTable('yara_interaction.ai_execution_jobs')
            .set({
              status,
              lease_owner: null,
              lease_expires_at: null,
              updated_at: now,
            })
            .where('run_id', '=', job.run_id)
            .execute();
          terminalized += 1;
        }
      }
      return { requeued, reconciliationRequired, terminalized };
    });
  }

  public async hasPendingExecutionJobs(): Promise<boolean> {
    const job = await this.database
      .selectFrom('yara_interaction.ai_execution_jobs')
      .select('run_id')
      .where('status', '=', 'queued')
      .limit(1)
      .executeTakeFirst();
    return job !== undefined;
  }

  public async claimNextExecutionJob(input: {
    readonly workerId: string;
    readonly now: Date;
    readonly leaseDurationMs: number;
  }): Promise<ClaimedAIExecutionJob | null> {
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseDurationMs);
    const result = await sql<{
      run_id: string;
      attempt: number;
    }>`
      with candidate as (
        select job.run_id
        from yara_interaction.ai_execution_jobs job
        join yara_interaction.ai_execution_runs run on run.id = job.run_id
        where job.status = 'queued' and run.status = 'pending'
        order by job.created_at, job.run_id
        for update of job skip locked
        limit 1
      )
      update yara_interaction.ai_execution_jobs job
      set status = 'claimed',
          attempt = job.attempt + 1,
          lease_owner = ${input.workerId},
          lease_expires_at = ${leaseExpiresAt},
          last_error = null,
          updated_at = ${input.now}
      from candidate
      where job.run_id = candidate.run_id
      returning job.run_id, job.attempt
    `.execute(this.database);
    const row = result.rows[0];
    return row
      ? {
          runId: aiExecutionRunId(row.run_id),
          attempt: row.attempt,
          leaseOwner: input.workerId,
          leaseExpiresAt,
        }
      : null;
  }

  public async heartbeatExecutionJob(input: {
    readonly runId: AIExecutionRunId;
    readonly workerId: string;
    readonly now: Date;
    readonly leaseDurationMs: number;
  }): Promise<boolean> {
    const result = await this.database
      .updateTable('yara_interaction.ai_execution_jobs')
      .set({
        lease_expires_at: new Date(input.now.getTime() + input.leaseDurationMs),
        updated_at: input.now,
      })
      .where('run_id', '=', input.runId)
      .where('status', '=', 'claimed')
      .where('lease_owner', '=', input.workerId)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  public async settleExecutionJob(input: {
    readonly runId: AIExecutionRunId;
    readonly workerId: string;
    readonly now: Date;
  }): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom('yara_interaction.ai_execution_jobs as job')
        .innerJoin('yara_interaction.ai_execution_runs as run', 'run.id', 'job.run_id')
        .select(['job.status as job_status', 'job.lease_owner', 'run.status as run_status'])
        .where('job.run_id', '=', input.runId)
        .forUpdate('job')
        .executeTakeFirst();
      if (
        !row ||
        row.job_status !== 'claimed' ||
        row.lease_owner !== input.workerId ||
        row.run_status === 'pending' ||
        row.run_status === 'running'
      ) {
        return false;
      }
      const status =
        row.run_status === 'completed'
          ? 'completed'
          : row.run_status === 'cancelled'
            ? 'cancelled'
            : 'failed';
      await transaction
        .updateTable('yara_interaction.ai_execution_jobs')
        .set({
          status,
          lease_owner: null,
          lease_expires_at: null,
          updated_at: input.now,
        })
        .where('run_id', '=', input.runId)
        .execute();
      return true;
    });
  }
}
