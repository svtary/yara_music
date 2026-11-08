import type { AIExecutionRunId, ModelUsage } from './execution-run.js';

export interface ModelInputMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface ModelExecutionRequest {
  readonly runId: AIExecutionRunId;
  readonly model: string;
  readonly systemInstruction: string;
  readonly messages: readonly ModelInputMessage[];
  readonly maxOutputCharacters: number;
  readonly signal: AbortSignal;
}

export type ModelProviderEvent =
  | { readonly type: 'text.delta'; readonly delta: string }
  | {
      readonly type: 'completed';
      readonly providerResponseId?: string;
      readonly usage?: ModelUsage;
    };

export type ModelProviderFailureCode =
  'unavailable' | 'timeout' | 'rate_limited' | 'invalid_response' | 'aborted' | 'failed';

export class ModelProviderError extends Error {
  public constructor(
    public readonly code: ModelProviderFailureCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ModelProviderError';
  }
}

export interface ModelProviderPort {
  readonly provider: string;
  stream(request: ModelExecutionRequest): AsyncIterable<ModelProviderEvent>;
}

export class UnavailableModelProvider implements ModelProviderPort {
  public readonly provider = 'disabled';

  public async *stream(): AsyncIterable<ModelProviderEvent> {
    yield* [] as ModelProviderEvent[];
    throw new ModelProviderError(
      'unavailable',
      'No eligible model provider is configured for this environment.',
      false,
    );
  }
}
