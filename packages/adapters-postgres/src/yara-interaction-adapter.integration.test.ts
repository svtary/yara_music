import { aiExecutionRunId, createAIExecutionRun } from '@yara/ai-runtime';
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
      (await adapter.listMeaningfulConversationsForOwner('owner:1', 10)).map(({ id }) => id),
    ).toEqual([
      newerId,
      olderId,
      conversationId('conversation:yara:11111111-1111-4111-8111-111111111111'),
    ]);
    expect(await adapter.listMeaningfulConversationsForOwner('owner:missing', 10)).toEqual([]);
  });
});
