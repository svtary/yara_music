import { proxyYaraJson } from '../../../../../../lib/server/yara-proxy';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyYaraJson(`/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: await request.text(),
  });
}
