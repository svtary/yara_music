import type { AIExecutionRunId } from '@yara/ai-runtime';

import type { AIExecutionJobQueuePort } from './yara-interaction-port.js';

export interface AIExecutionRunnerPort {
  execute(runId: AIExecutionRunId): Promise<void>;
  abort(runId: AIExecutionRunId): void;
}

export interface DurableExecutionWorkerOptions {
  readonly workerId: string;
  readonly leaseDurationMs: number;
  readonly heartbeatIntervalMs: number;
}

/** Claims durable PostgreSQL work; it never becomes Conversation or AIExecutionRun authority. */
export class DurableAIExecutionWorker {
  private activeRunId: AIExecutionRunId | null = null;

  public constructor(
    private readonly queue: AIExecutionJobQueuePort,
    private readonly execution: AIExecutionRunnerPort,
    private readonly options: DurableExecutionWorkerOptions,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public abortActive(): void {
    if (this.activeRunId) this.execution.abort(this.activeRunId);
  }

  public hasPendingWork(): Promise<boolean> {
    return this.queue.hasPendingExecutionJobs();
  }

  public async recover(): Promise<{
    readonly requeued: number;
    readonly reconciliationRequired: number;
    readonly terminalized: number;
  }> {
    return this.queue.recoverStaleExecutionJobs(this.now());
  }

  public async processNext(): Promise<boolean> {
    const job = await this.queue.claimNextExecutionJob({
      workerId: this.options.workerId,
      now: this.now(),
      leaseDurationMs: this.options.leaseDurationMs,
    });
    if (!job) return false;
    this.activeRunId = job.runId;
    const heartbeat = setInterval(() => {
      void this.queue
        .heartbeatExecutionJob({
          runId: job.runId,
          workerId: this.options.workerId,
          now: this.now(),
          leaseDurationMs: this.options.leaseDurationMs,
        })
        .then((leaseHeld) => {
          if (!leaseHeld) this.execution.abort(job.runId);
        })
        .catch(() => this.execution.abort(job.runId));
    }, this.options.heartbeatIntervalMs);
    try {
      await this.execution.execute(job.runId);
      await this.queue.settleExecutionJob({
        runId: job.runId,
        workerId: this.options.workerId,
        now: this.now(),
      });
    } finally {
      clearInterval(heartbeat);
      this.activeRunId = null;
    }
    return true;
  }
}
