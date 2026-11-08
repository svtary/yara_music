import { describe, expect, it } from 'vitest';

import { YaraSseDecoder } from './sse-decoder';

describe('YaraSseDecoder', () => {
  it('preserves sequence IDs across split transport chunks', () => {
    const decoder = new YaraSseDecoder();
    expect(decoder.push('id: 1\nevent: run.started\ndata: {"type":"run.started",')).toEqual([]);
    expect(
      decoder.push(
        '"data":{"provider":"openai","model":"test","startedAt":"2026-11-06T00:00:00Z"}}\n\n',
      ),
    ).toMatchObject([{ id: '1', type: 'run.started' }]);
  });

  it('keeps heartbeat separate from durable message deltas', () => {
    const decoder = new YaraSseDecoder();
    const events = decoder.push(
      'event: heartbeat\ndata: {"timestamp":"now"}\n\nid: 2\nevent: message.delta\ndata: {"type":"message.delta","data":{"delta":"Hi"}}\n\n',
    );
    expect(events.map((event) => event.type)).toEqual(['heartbeat', 'message.delta']);
  });
});
