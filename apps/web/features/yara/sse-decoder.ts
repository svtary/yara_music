import type { YaraRunEventContract } from '@yara/contracts';

export interface DecodedYaraSseEvent {
  readonly id?: string;
  readonly type: string;
  readonly data: YaraRunEventContract | { readonly timestamp: string };
}

function parseBlock(block: string): DecodedYaraSseEvent | null {
  let id: string | undefined;
  let type = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r?\n/u)) {
    if (line.startsWith('id:')) id = line.slice(3).trim();
    else if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  return { ...(id ? { id } : {}), type, data: JSON.parse(data.join('\n')) };
}

export class YaraSseDecoder {
  private buffer = '';

  public push(chunk: string): readonly DecodedYaraSseEvent[] {
    this.buffer += chunk.replaceAll('\r\n', '\n');
    const blocks = this.buffer.split('\n\n');
    this.buffer = blocks.pop() ?? '';
    return blocks.map(parseBlock).filter((value): value is DecodedYaraSseEvent => value !== null);
  }
}
