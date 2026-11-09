import { aiExecutionRunId, createAIExecutionRun } from '@yara/ai-runtime';
import {
  ActiveAIExecutionRunConflictError,
  ConversationApplicationService,
  IdempotencyConflictError,
} from '@yara/application';
import { conversationId, createYaraConversation, messageId } from '@yara/domain-yara-interaction';
import type { Kysely } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPostgresDatabase, migrateYaraDatabase, type YaraDatabase } from './index.js';
import { PostgresYaraInteractionAdapter } from './yara-interaction-adapter.js';

const { Pool } = pg;
const describePostgres =
  process.env['YARA_RUN_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describePostgres('PostgreSQL Yara Interaction persistence', () => {
  const sourceUrl = process.env['DATABASE_URL'];
  const databaseName = `yara_interaction_test_${process.pid}`;
  let admin: InstanceType<typeof Pool>;
  let database: Kysely<YaraDatabase>;
  let adapter: PostgresYaraInteractionAdapter;

  beforeAll(async () => {
    if (!sourceUrl) throw new Error('DATABASE_URL is required for PostgreSQL integration tests');
    admin = new Pool({ connectionString: sourceUrl, max: 1 });
    await admin.query(`drop database if exists "${databaseName}"`);
    await admin.query(`create database "${databaseName}"`);
    const target = new URL(sourceUrl);
    target.pathname = `/${databaseName}`;
    database = createPostgresDatabase(target.toString(), { maxConnections: 4 });
    await migrateYaraDatabase(database);
    adapter = new PostgresYaraInteractionAdapter(database);
  }, 30_000);

  afterAll(async () => {
    if (database) await database.destroy();
    if (admin) {
      await admin.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1',
        [databaseName],
      );
      await admin.query(`drop database if exists "${databaseName}"`);
      await admin.end();
    }
  });

  it('separates durable messages from replayable partial deltas and enforces owner reads', async () => {
    const createdAt = new Date('2026-11-06T10:00:00.000Z');
    const id = conversationId('conversation:yara:11111111-1111-4111-8111-111111111111');
    const userMessageId = messageId('message:yara:22222222-2222-4222-8222-222222222222');
    const runId = aiExecutionRunId('ai-run:yara:33333333-3333-4333-8333-333333333333');
    await adapter.createConversation('owner:1', createYaraConversation({ id, createdAt }));
    await adapter.acceptUserMessageAndRun({
      ownerRef: 'owner:1',
      idempotencyKey: 'send:integration:first',
      semanticFingerprint: '1'.repeat(64),
      conversationId: id,
      messageId: userMessageId,
      content: 'What makes this feel spacious?',
      createdAt,
      run: createAIExecutionRun({
        id: runId,
        conversationId: id,
        triggerMessageId: userMessageId,
        status: 'pending',
        provider: 'test',
        model: 'test-model',
        createdAt,
      }),
    });
    await adapter.startRun(runId, new Date('2026-11-06T10:00:01.000Z'));
    await adapter.appendRunEvent(
      runId,
      { type: 'message.delta', data: { delta: 'A long reverb tail' } },
      new Date('2026-11-06T10:00:02.000Z'),
    );

    expect((await adapter.getConversationForOwner('owner:1', id))?.messages).toHaveLength(1);
    expect(await adapter.getConversationForOwner('owner:2', id)).toBeNull();
    expect(await adapter.getRunForOwner('owner:2', runId)).toBeNull();

    const completed = await adapter.completeRunWithAssistantMessage({
      runId,
      messageId: messageId('message:yara:44444444-4444-4444-8444-444444444444'),
      content: 'A long reverb tail leaves open space around the voice.',
      providerResponseId: 'provider-only-id',
      usage: { inputTokens: 12, outputTokens: 13, totalTokens: 25 },
      finishedAt: new Date('2026-11-06T10:00:03.000Z'),
    });
    expect(completed?.run.status).toBe('completed');
    await expect(
      adapter.completeRunWithAssistantMessage({
        runId,
        messageId: messageId('message:yara:45454545-4545-4545-8545-454545454545'),
        content: 'A duplicate completion must never be committed.',
        finishedAt: new Date('2026-11-06T10:00:04.000Z'),
      }),
    ).resolves.toBeNull();
    expect((await adapter.getConversationForOwner('owner:1', id))?.messages).toHaveLength(2);
    expect(
      (
        await adapter.listRunEventsForOwner({
          ownerRef: 'owner:1',
          runId,
          afterSequence: 1,
          limit: 10,
        })
      ).map(({ event }) => event.type),
    ).toEqual(['message.delta', 'message.completed', 'run.completed']);
    expect(
      await adapter.listRunEventsForOwner({
        ownerRef: 'owner:2',
        runId,
        afterSequence: 0,
        limit: 10,
      }),
    ).toEqual([]);
  });

  it('lists only meaningful owner conversations in deterministic recent order', async () => {
    const emptyId = conversationId('conversation:yara:55555555-5555-4555-8555-555555555555');
    const olderId = conversationId('conversation:yara:66666666-6666-4666-8666-666666666666');
    const newerId = conversationId('conversation:yara:77777777-7777-4777-8777-777777777777');
    const otherId = conversationId('conversation:yara:88888888-8888-4888-8888-888888888888');
    await adapter.createConversation(
      'owner:1',
      createYaraConversation({ id: emptyId, createdAt: new Date('2026-11-08T11:00:00Z') }),
    );

    for (const [id, owner, time, suffix] of [
      [olderId, 'owner:1', '2026-11-08T09:00:00Z', '1'],
      [newerId, 'owner:1', '2026-11-08T10:00:00Z', '2'],
      [otherId, 'owner:2', '2026-11-08T12:00:00Z', '3'],
    ] as const) {
      const at = new Date(time);
      await adapter.createConversation(owner, createYaraConversation({ id, createdAt: at }));
      const userMessageId = messageId(`message:yara:99999999-9999-4999-8999-99999999999${suffix}`);
      await adapter.acceptUserMessageAndRun({
        ownerRef: owner,
        idempotencyKey: `send:history:${suffix}`,
        semanticFingerprint: suffix.repeat(64),
        conversationId: id,
        messageId: userMessageId,
        content: `Question ${suffix}`,
        createdAt: at,
        run: createAIExecutionRun({
          id: aiExecutionRunId(`ai-run:yara:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${suffix}`),
          conversationId: id,
          triggerMessageId: userMessageId,
          status: 'pending',
          provider: 'test',
          model: 'test-model',
          createdAt: at,
        }),
      });
    }

    expect(
      (await adapter.listConversationSummariesForOwner('owner:1', 10)).map(({ id }) => id),
    ).toEqual([
      newerId,
      olderId,
      conversationId('conversation:yara:11111111-1111-4111-8111-111111111111'),
    ]);
    expect(await adapter.listConversationSummariesForOwner('owner:missing', 10)).toEqual([]);
  });

  it('rolls back every initial command write when durable run insertion fails', async () => {
    const createdAt = new Date('2026-11-08T13:00:00.000Z');
    const id = conversationId('conversation:yara:12121212-1212-4212-8212-121212121212');
    const userMessageId = messageId('message:yara:34343434-3434-4434-8434-343434343434');
    const missingConversationId = conversationId(
      'conversation:yara:56565656-5656-4656-8656-565656565656',
    );

    await expect(
      adapter.startConversationWithMessage({
        ownerRef: 'owner:rollback',
        idempotencyKey: 'start:rollback-test',
        semanticFingerprint: 'f'.repeat(64),
        conversation: createYaraConversation({ id, createdAt }),
        messageId: userMessageId,
        content: 'This transaction must roll back.',
        createdAt,
        run: createAIExecutionRun({
          id: aiExecutionRunId('ai-run:yara:78787878-7878-4878-8878-787878787878'),
          conversationId: missingConversationId,
          triggerMessageId: userMessageId,
          status: 'pending',
          provider: 'test',
          model: 'test-model',
          createdAt,
        }),
      }),
    ).rejects.toThrow();

    expect(await adapter.getConversationForOwner('owner:rollback', id)).toBeNull();
  });

  it('atomically deduplicates commands, enforces one active run, and recovers leased jobs safely', async () => {
    const cleanupAt = new Date('2026-11-09T00:00:00.000Z');
    await database
      .updateTable('yara_interaction.ai_execution_runs')
      .set({ status: 'cancelled', finished_at: cleanupAt, updated_at: cleanupAt })
      .where('status', '=', 'pending')
      .execute();
    await database
      .updateTable('yara_interaction.ai_execution_jobs')
      .set({
        status: 'cancelled',
        lease_owner: null,
        lease_expires_at: null,
        updated_at: cleanupAt,
      })
      .where('status', '=', 'queued')
      .execute();

    let tick = 0;
    const application = new ConversationApplicationService(
      adapter,
      { provider: 'test', model: 'test-model' },
      () => new Date(Date.UTC(2026, 10, 9, 10, 0, tick++)),
    );
    const initial = await application.start('owner:reliability', 'Start once', 'start:stable-key');
    expect(await application.start('owner:reliability', 'Start once', 'start:stable-key')).toEqual(
      initial,
    );
    await expect(
      application.start('owner:reliability', 'Different intent', 'start:stable-key'),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(
      Number(
        (
          await database
            .selectFrom('yara_interaction.conversations')
            .select(({ fn }) => fn.countAll<number>().as('count'))
            .where('owner_ref', '=', 'owner:reliability')
            .executeTakeFirstOrThrow()
        ).count,
      ),
    ).toBe(1);
    await expect(
      application.send(
        'owner:reliability',
        initial.conversationId,
        'Overlapping message',
        'send:overlap',
      ),
    ).rejects.toBeInstanceOf(ActiveAIExecutionRunConflictError);

    await expect(
      database
        .insertInto('yara_interaction.ai_execution_runs')
        .values({
          id: 'ai-run:yara:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          conversation_id: initial.conversationId,
          trigger_message_id: initial.messageId,
          assistant_message_id: null,
          status: 'pending',
          provider: 'test',
          model: 'test-model',
          provider_response_id: null,
          usage: null,
          failure: null,
          created_at: cleanupAt,
          started_at: null,
          finished_at: null,
          updated_at: cleanupAt,
        })
        .execute(),
    ).rejects.toThrow();

    await adapter.cancelRunForOwner('owner:reliability', initial.runId, cleanupAt);
    const concurrent = await Promise.allSettled([
      application.send(
        'owner:reliability',
        initial.conversationId,
        'Concurrent A',
        'send:concurrent-a',
      ),
      application.send(
        'owner:reliability',
        initial.conversationId,
        'Concurrent B',
        'send:concurrent-b',
      ),
    ]);
    const successful = concurrent.find(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof application.send>>> =>
        result.status === 'fulfilled',
    );
    const rejected = concurrent.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(successful).toBeDefined();
    expect(rejected?.reason).toBeInstanceOf(ActiveAIExecutionRunConflictError);
    const receipt = successful!.value;

    const firstClaim = await adapter.claimNextExecutionJob({
      workerId: 'worker:test-a',
      now: new Date('2026-11-09T10:01:00.000Z'),
      leaseDurationMs: 5_000,
    });
    expect(firstClaim?.runId).toBe(receipt.runId);
    expect(
      await adapter.recoverStaleExecutionJobs(new Date('2026-11-09T10:01:06.000Z')),
    ).toMatchObject({ requeued: 1, reconciliationRequired: 0 });
    const reclaimed = await adapter.claimNextExecutionJob({
      workerId: 'worker:test-b',
      now: new Date('2026-11-09T10:01:07.000Z'),
      leaseDurationMs: 5_000,
    });
    expect(reclaimed).toMatchObject({ runId: receipt.runId, attempt: 2 });
    await adapter.startRun(receipt.runId, new Date('2026-11-09T10:01:08.000Z'));
    expect(
      await adapter.recoverStaleExecutionJobs(new Date('2026-11-09T10:01:13.000Z')),
    ).toMatchObject({ requeued: 0, reconciliationRequired: 1 });
    expect((await adapter.getRun(receipt.runId))?.run.status).toBe('failed');
    expect(
      await adapter.claimNextExecutionJob({
        workerId: 'worker:test-c',
        now: new Date('2026-11-09T10:01:14.000Z'),
        leaseDurationMs: 5_000,
      }),
    ).toBeNull();
  });
});
