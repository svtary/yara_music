import { proxyYaraJson } from '../../../../../lib/server/yara-proxy';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyYaraJson(`/ai-runs/${encodeURIComponent(id)}`);
}
