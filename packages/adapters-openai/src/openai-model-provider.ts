import type {
  ModelExecutionRequest,
  ModelProviderEvent,
  ModelProviderPort,
} from '@yara/ai-runtime';
import { ModelProviderError } from '@yara/ai-runtime';
import OpenAI from 'openai';

export interface OpenAIModelProviderOptions {
  readonly apiKey: string;
  readonly baseURL?: string;
  readonly timeoutMs: number;
}

type OpenAIStreamEvent = {
  readonly type?: string;
  readonly delta?: string;
  readonly message?: string;
  readonly response?: {
    readonly id?: string;
    readonly error?: { readonly message?: string } | null;
    readonly usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
      readonly total_tokens?: number;
    } | null;
  };
};

interface OpenAIResponsesClient {
  create(
    body: Record<string, unknown>,
    options: { readonly signal: AbortSignal },
  ): Promise<AsyncIterable<OpenAIStreamEvent>>;
}

interface OpenAIClient {
  readonly responses: OpenAIResponsesClient;
}

function providerError(error: unknown): ModelProviderError {
  if (error instanceof ModelProviderError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new ModelProviderError('aborted', 'The model request was aborted.', false);
  }
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { readonly status?: unknown }).status)
      : undefined;
  if (status === 429)
    return new ModelProviderError('rate_limited', 'Model rate limit reached.', true);
  if (status === 408 || status === 504) {
    return new ModelProviderError('timeout', 'Model request timed out.', true);
  }
  if (status !== undefined && status >= 500) {
    return new ModelProviderError('unavailable', 'Model provider is unavailable.', true);
  }
  return new ModelProviderError('failed', 'Model provider request failed.', false);
}

export class OpenAIModelProviderAdapter implements ModelProviderPort {
  public readonly provider = 'openai';
  private readonly client: OpenAIClient;

  public constructor(options: OpenAIModelProviderOptions, client?: OpenAIClient) {
    this.client =
      client ??
      (new OpenAI({
        apiKey: options.apiKey,
        timeout: options.timeoutMs,
        ...(options.baseURL ? { baseURL: options.baseURL } : {}),
      }) as unknown as OpenAIClient);
  }

  public async *stream(request: ModelExecutionRequest): AsyncIterable<ModelProviderEvent> {
    let stream: AsyncIterable<OpenAIStreamEvent>;
    try {
      stream = await this.client.responses.create(
        {
          model: request.model,
          instructions: request.systemInstruction,
          input: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          max_output_tokens: Math.max(16, Math.ceil(request.maxOutputCharacters / 4)),
          stream: true,
          store: false,
        },
        { signal: request.signal },
      );
    } catch (error) {
      throw providerError(error);
    }

    try {
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          if (typeof event.delta !== 'string' || event.delta.length === 0) continue;
          yield { type: 'text.delta', delta: event.delta };
        } else if (event.type === 'response.completed') {
          const usage = event.response?.usage;
          yield {
            type: 'completed',
            ...(event.response?.id ? { providerResponseId: event.response.id } : {}),
            ...(usage
              ? {
                  usage: {
                    inputTokens: usage.input_tokens ?? 0,
                    outputTokens: usage.output_tokens ?? 0,
                    totalTokens: usage.total_tokens ?? 0,
                  },
                }
              : {}),
          };
        } else if (
          event.type === 'response.failed' ||
          event.type === 'response.incomplete' ||
          event.type === 'error'
        ) {
          throw new ModelProviderError(
            'failed',
            'Model provider did not complete the response.',
            event.type !== 'response.failed',
          );
        }
      }
    } catch (error) {
      throw providerError(error);
    }
  }
}
