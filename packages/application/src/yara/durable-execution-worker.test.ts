import { aiExecutionRunId } from '@yara/ai-runtime';
import { describe, expect, it, vi } from 'vitest';

import { DurableAIExecutionWorker } from './durable-execution-worker.js';
import type { AIExecutionJobQueuePort } from './yara-interaction-port.js';

const runId = aiExecutionRunId('ai-run:yara:11111111-1111-4111-8111-111111111111');

describe('DurableAIExecutionWorker', () => {
  it('claims persisted work, executes it, and settles only after terminal persistence', async () => {
    const claimNextExecutionJob = vi.fn().mockResolvedValue({
      runId,
      attempt: 1,
      leaseOwner: 'worker:test',
      leaseExpiresAt: new Date('2026-11-09T10:00:45Z'),
    });
    const settleExecutionJob = vi.fn().mockResolvedValue(true);
    const queue = {
      hasPendingExecutionJobs: vi.fn().mockResolvedValue(true),
      recoverStaleExecutionJobs: vi.fn(),
      claimNextExecutionJob,
      heartbeatExecutionJob: vi.fn().mockResolvedValue(true),
      settleExecutionJob,
    } as AIExecutionJobQueuePort;
    const execute = vi.fn().mockResolvedValue(undefined);
    const worker = new DurableAIExecutionWorker(
      queue,
      { execute, abort: vi.fn() },
      { workerId: 'worker:test', leaseDurationMs: 45_000, heartbeatIntervalMs: 10_000 },
      () => new Date('2026-11-09T10:00:00Z'),
    );

    await expect(worker.processNext()).resolves.toBe(true);
    expect(claimNextExecutionJob).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(runId);
    expect(settleExecutionJob).toHaveBeenCalledWith(
      expect.objectContaining({ runId, workerId: 'worker:test' }),
    );
  });

  it('does not execute when no durable job is claimable', async () => {
    const queue = {
      hasPendingExecutionJobs: vi.fn().mockResolvedValue(false),
      recoverStaleExecutionJobs: vi.fn(),
      claimNextExecutionJob: vi.fn().mockResolvedValue(null),
      heartbeatExecutionJob: vi.fn(),
      settleExecutionJob: vi.fn(),
    } as AIExecutionJobQueuePort;
    const execute = vi.fn();
    const worker = new DurableAIExecutionWorker(
      queue,
      { execute, abort: vi.fn() },
      {
        workerId: 'worker:test',
        leaseDurationMs: 45_000,
        heartbeatIntervalMs: 10_000,
      },
    );

    await expect(worker.processNext()).resolves.toBe(false);
    expect(execute).not.toHaveBeenCalled();
    await expect(worker.hasPendingWork()).resolves.toBe(false);
  });
});
