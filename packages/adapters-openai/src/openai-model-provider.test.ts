import { describe, expect, it } from 'vitest';
import { aiExecutionRunId } from '@yara/ai-runtime';

import { OpenAIModelProviderAdapter } from './openai-model-provider.js';

const request = {
  runId: aiExecutionRunId('ai-run:yara:11111111-1111-4111-8111-111111111111'),
  model: 'test-model',
  systemInstruction: 'Be concise.',
  messages: [{ role: 'user' as const, content: 'Hello' }],
  maxOutputCharacters: 1000,
  signal: new AbortController().signal,
};

describe('OpenAIModelProviderAdapter', () => {
  it('normalizes provider stream events without leaking SDK types', async () => {
    const client = {
      responses: {
        async create() {
          return (async function* () {
            yield { type: 'response.output_text.delta', delta: 'Hello' };
            yield {
              type: 'response.completed',
              response: {
                id: 'resp-provider-only',
                usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 },
              },
            };
          })();
        },
      },
    };
    const adapter = new OpenAIModelProviderAdapter({ apiKey: 'test', timeoutMs: 1_000 }, client);
    const events = [];
    for await (const event of adapter.stream(request)) events.push(event);
    expect(events).toEqual([
      { type: 'text.delta', delta: 'Hello' },
      {
        type: 'completed',
        providerResponseId: 'resp-provider-only',
        usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
      },
    ]);
  });

  it('maps provider failures to a safe Yara error', async () => {
    const client = {
      responses: {
        async create() {
          throw Object.assign(new Error('secret provider detail'), { status: 429 });
        },
      },
    };
    const adapter = new OpenAIModelProviderAdapter({ apiKey: 'test', timeoutMs: 1_000 }, client);
    await expect(adapter.stream(request)[Symbol.asyncIterator]().next()).rejects.toMatchObject({
      code: 'rate_limited',
      retryable: true,
    });
  });
});
