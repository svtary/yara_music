import { proxyYaraJson } from '../../../../../../lib/server/yara-proxy';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyYaraJson(`/ai-runs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}
