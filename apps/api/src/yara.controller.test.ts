import type { ApiConfig } from '@yara/config';
import { lastValueFrom, toArray } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { YaraController } from './yara.controller.js';

const config: ApiConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4000,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  logLevel: 'info',
  modelProvider: 'disabled',
  modelName: 'test-model',
  yaraActorRef: 'owner:test',
};

describe('YaraController SSE replay', () => {
  it('delegates atomic conversation start without executing AI in the API process', async () => {
    const start = vi.fn().mockResolvedValue({
      conversationId: 'conversation:yara:11111111-1111-4111-8111-111111111111',
      messageId: 'message:yara:22222222-2222-4222-8222-222222222222',
      runId: 'ai-run:yara:33333333-3333-4333-8333-333333333333',
    });
    const controller = new YaraController(config, { start } as never);

    await expect(
      controller.startConversation({
        content: 'Why does this feel open?',
        idempotencyKey: 'start:test-key',
      }),
    ).resolves.toMatchObject({
      conversationId: 'conversation:yara:11111111-1111-4111-8111-111111111111',
      runId: 'ai-run:yara:33333333-3333-4333-8333-333333333333',
    });
    expect(start).toHaveBeenCalledWith('owner:test', 'Why does this feel open?', 'start:test-key');
  });

  it('lists bounded conversation summaries for the configured owner', async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: 'conversation:yara:11111111-1111-4111-8111-111111111111',
        updatedAt: new Date('2026-11-06T10:00:00.000Z'),
        title: 'Why does this feel open?',
        preview: 'A long reverb tail leaves space.',
        messageCount: 2,
        lastMessageRole: 'assistant',
      },
    ]);
    const controller = new YaraController(config, { list } as never);

    await expect(controller.listConversations('12')).resolves.toEqual({
      conversations: [
        expect.objectContaining({
          title: 'Why does this feel open?',
          updatedAt: '2026-11-06T10:00:00.000Z',
        }),
      ],
    });
    expect(list).toHaveBeenCalledWith('owner:test', 12);
  });

  it('replays after Last-Event-ID and closes on a terminal event', async () => {
    const listEvents = vi.fn().mockResolvedValue([
      {
        runId: 'ai-run:yara:11111111-1111-4111-8111-111111111111',
        sequence: 5,
        event: {
          type: 'run.completed',
          data: { completedAt: '2026-11-06T10:00:00.000Z' },
        },
        createdAt: new Date('2026-11-06T10:00:00.000Z'),
      },
    ]);
    const conversations = { listEvents };
    const controller = new YaraController(config, conversations as never);

    const events = await lastValueFrom(controller.streamRun('run-id', '4').pipe(toArray()));
    expect(listEvents).toHaveBeenCalledWith('owner:test', 'run-id', 4);
    expect(events).toEqual([expect.objectContaining({ id: '5', type: 'run.completed' })]);
  });
});
