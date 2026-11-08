import { proxyYaraJson } from '../../../../../lib/server/yara-proxy';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyYaraJson(`/conversations/${encodeURIComponent(id)}`);
}
