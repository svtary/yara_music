import type { ZodType } from 'zod';

export class ProviderHttpError extends Error {
  public constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export class ProviderResponseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ProviderResponseError';
  }
}

export interface ProviderHttpClientOptions {
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly timeoutMs?: number;
  readonly minimumIntervalMs?: number;
  readonly maximumRetries?: number;
  readonly fetch?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
}

export class ProviderHttpClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly minimumIntervalMs: number;
  private readonly maximumRetries: number;
  private queue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  public constructor(private readonly options: ProviderHttpClientOptions) {
    this.fetchImplementation = options.fetch ?? fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.minimumIntervalMs = options.minimumIntervalMs ?? 1_000;
    this.maximumRetries = options.maximumRetries ?? 2;
  }

  public async getJson<T>(path: string, schema: ZodType<T>): Promise<T | null> {
    for (let attempt = 0; attempt <= this.maximumRetries; attempt += 1) {
      try {
        const response = await this.pacedFetch(path);
        if (response.status === 404) return null;
        if (this.isTransient(response.status) && attempt < this.maximumRetries) {
          await this.sleep(250 * 2 ** attempt);
          continue;
        }
        if (!response.ok) {
          throw new ProviderHttpError(
            `Provider request failed with HTTP ${response.status}.`,
            response.status,
          );
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new ProviderResponseError('Provider returned malformed JSON.');
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          throw new ProviderResponseError(
            'Provider response did not match the approved DTO schema.',
          );
        }
        return parsed.data;
      } catch (error) {
        if (
          attempt < this.maximumRetries &&
          !(error instanceof ProviderResponseError) &&
          !(error instanceof ProviderHttpError && !this.isTransient(error.status))
        ) {
          await this.sleep(250 * 2 ** attempt);
          continue;
        }
        if (error instanceof ProviderHttpError || error instanceof ProviderResponseError)
          throw error;
        throw new ProviderHttpError(
          error instanceof Error
            ? `Provider request failed: ${error.message}`
            : 'Provider request failed.',
        );
      }
    }
    throw new ProviderHttpError('Provider retry budget exhausted.');
  }

  private async pacedFetch(path: string): Promise<Response> {
    let releaseQueue!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    await previous;
    try {
      const wait = Math.max(0, this.nextRequestAt - this.now());
      if (wait > 0) await this.sleep(wait);
      this.nextRequestAt = this.now() + this.minimumIntervalMs;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        return await this.fetchImplementation(new URL(path, this.options.baseUrl), {
          headers: {
            Accept: 'application/json',
            'User-Agent': this.options.userAgent,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      releaseQueue();
    }
  }

  private isTransient(status: number | undefined): boolean {
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
}
