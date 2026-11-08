declare const aiExecutionRunIdBrand: unique symbol;

export type AIExecutionRunId = string & {
  readonly [aiExecutionRunIdBrand]: 'AIExecutionRunId';
};

export type AIExecutionRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type AIExecutionFailureCode =
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'model_failure'
  | 'invalid_provider_response'
  | 'stream_interrupted';

export interface AIExecutionFailure {
  readonly code: AIExecutionFailureCode;
  readonly message: string;
}

export interface ModelUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface AIExecutionRun {
  readonly id: AIExecutionRunId;
  readonly conversationId: string;
  readonly triggerMessageId: string;
  readonly status: AIExecutionRunStatus;
  readonly provider: string;
  readonly model: string;
  readonly providerResponseId?: string;
  readonly usage?: ModelUsage;
  readonly failure?: AIExecutionFailure;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
}

export class AIExecutionInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AIExecutionInvariantError';
  }
}

const runIdentifier =
  /^ai-run:yara:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function aiExecutionRunId(value: string): AIExecutionRunId {
  if (typeof value !== 'string' || !runIdentifier.test(value)) {
    throw new AIExecutionInvariantError(
      'AIExecutionRunId must be a Yara-owned opaque UUID reference.',
    );
  }
  return value as AIExecutionRunId;
}

function validDate(value: Date | undefined, label: string): Date | undefined {
  if (value === undefined) return undefined;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new AIExecutionInvariantError(`${label} must be a valid date.`);
  }
  return new Date(value.getTime());
}

function validateShape(run: AIExecutionRun): void {
  const started = run.startedAt !== undefined;
  const finished = run.finishedAt !== undefined;
  const failed = run.failure !== undefined;

  if (run.status === 'pending' && (started || finished || failed)) {
    throw new AIExecutionInvariantError(
      'A pending run cannot have execution or terminal metadata.',
    );
  }
  if (run.status === 'running' && (!started || finished || failed)) {
    throw new AIExecutionInvariantError(
      'A running run requires startedAt and no terminal metadata.',
    );
  }
  if (run.status === 'completed' && (!started || !finished || failed)) {
    throw new AIExecutionInvariantError(
      'A completed run requires startedAt/finishedAt and no failure.',
    );
  }
  if (run.status === 'failed' && (!started || !finished || !failed)) {
    throw new AIExecutionInvariantError(
      'A failed run requires startedAt/finishedAt and failure metadata.',
    );
  }
  if (run.status === 'cancelled' && (!finished || failed)) {
    throw new AIExecutionInvariantError(
      'A cancelled run requires finishedAt and no failure metadata.',
    );
  }
}

export function createAIExecutionRun(input: AIExecutionRun): AIExecutionRun {
  if (!input.provider.trim() || !input.model.trim()) {
    throw new AIExecutionInvariantError('AI execution provider and model metadata are required.');
  }
  const { startedAt, finishedAt, usage, failure, ...base } = input;
  const run: AIExecutionRun = Object.freeze({
    ...base,
    id: aiExecutionRunId(input.id),
    createdAt: validDate(input.createdAt, 'createdAt') as Date,
    ...(startedAt ? { startedAt: validDate(startedAt, 'startedAt') as Date } : {}),
    ...(finishedAt ? { finishedAt: validDate(finishedAt, 'finishedAt') as Date } : {}),
    ...(usage ? { usage: Object.freeze({ ...usage }) } : {}),
    ...(failure ? { failure: Object.freeze({ ...failure }) } : {}),
  });
  validateShape(run);
  return run;
}

export function startAIExecutionRun(run: AIExecutionRun, startedAt: Date): AIExecutionRun {
  if (run.status !== 'pending') {
    throw new AIExecutionInvariantError('Only a pending AIExecutionRun can start.');
  }
  return createAIExecutionRun({ ...run, status: 'running', startedAt });
}

export function completeAIExecutionRun(
  run: AIExecutionRun,
  input: {
    readonly finishedAt: Date;
    readonly providerResponseId?: string;
    readonly usage?: ModelUsage;
  },
): AIExecutionRun {
  if (run.status !== 'running') {
    throw new AIExecutionInvariantError('Only a running AIExecutionRun can complete.');
  }
  return createAIExecutionRun({
    ...run,
    status: 'completed',
    finishedAt: input.finishedAt,
    ...(input.providerResponseId ? { providerResponseId: input.providerResponseId } : {}),
    ...(input.usage ? { usage: input.usage } : {}),
  });
}

export function failAIExecutionRun(
  run: AIExecutionRun,
  failure: AIExecutionFailure,
  finishedAt: Date,
): AIExecutionRun {
  if (run.status !== 'running') {
    throw new AIExecutionInvariantError('Only a running AIExecutionRun can fail.');
  }
  return createAIExecutionRun({ ...run, status: 'failed', failure, finishedAt });
}

export function cancelAIExecutionRun(run: AIExecutionRun, finishedAt: Date): AIExecutionRun {
  if (run.status !== 'pending' && run.status !== 'running') {
    throw new AIExecutionInvariantError('Only a pending or running AIExecutionRun can cancel.');
  }
  return createAIExecutionRun({
    ...run,
    status: 'cancelled',
    finishedAt,
    ...(run.startedAt ? { startedAt: run.startedAt } : {}),
  });
}

export function isTerminalAIExecutionRun(status: AIExecutionRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
