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
  modelTimeoutMs: 1_000,
  yaraActorRef: 'owner:test',
};

describe('YaraController SSE replay', () => {
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
    const controller = new YaraController(config, { list } as never, { abort: vi.fn() } as never);

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
    const execution = { abort: vi.fn() };
    const controller = new YaraController(config, conversations as never, execution as never);

    const events = await lastValueFrom(controller.streamRun('run-id', '4').pipe(toArray()));
    expect(listEvents).toHaveBeenCalledWith('owner:test', 'run-id', 4);
    expect(events).toEqual([expect.objectContaining({ id: '5', type: 'run.completed' })]);
    expect(execution.abort).not.toHaveBeenCalled();
  });
});
