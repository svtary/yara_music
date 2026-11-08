import { describe, expect, it } from 'vitest';

import {
  cancelAIExecutionRun,
  aiExecutionRunId,
  completeAIExecutionRun,
  createAIExecutionRun,
  failAIExecutionRun,
  startAIExecutionRun,
} from './execution-run.js';

const createdAt = new Date('2026-11-06T10:00:00.000Z');
const run = createAIExecutionRun({
  id: aiExecutionRunId('ai-run:yara:11111111-1111-4111-8111-111111111111'),
  conversationId: 'conversation:yara:22222222-2222-4222-8222-222222222222',
  triggerMessageId: 'message:yara:33333333-3333-4333-8333-333333333333',
  status: 'pending',
  provider: 'openai',
  model: 'test-model',
  createdAt,
});

describe('AIExecutionRun', () => {
  it('keeps an execution attempt separate from conversation/message identity', () => {
    expect(run.id).toMatch(/^ai-run:yara:/u);
    expect(run.id).not.toBe(run.conversationId);
    expect(run.id).not.toBe(run.triggerMessageId);
  });

  it('allows the closed pending → running → completed lifecycle', () => {
    const running = startAIExecutionRun(run, new Date(createdAt.getTime() + 100));
    const completed = completeAIExecutionRun(running, {
      finishedAt: new Date(createdAt.getTime() + 1000),
      providerResponseId: 'provider-response-replaceable',
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
    });
    expect(completed.status).toBe('completed');
    expect(completed.usage?.totalTokens).toBe(20);
  });

  it('models failure and cancellation without reopening a terminal run', () => {
    const running = startAIExecutionRun(run, new Date(createdAt.getTime() + 100));
    const failed = failAIExecutionRun(
      running,
      { code: 'provider_timeout', message: 'The model timed out.' },
      new Date(createdAt.getTime() + 1000),
    );
    expect(failed.status).toBe('failed');
    expect(() => startAIExecutionRun(failed, new Date('2026-11-06T10:00:02.000Z'))).toThrow();

    const cancelled = cancelAIExecutionRun(run, new Date(createdAt.getTime() + 500));
    expect(cancelled.status).toBe('cancelled');
    expect(() => completeAIExecutionRun(cancelled, { finishedAt: new Date() })).toThrow();
  });
});
