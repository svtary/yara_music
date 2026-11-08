import { proxyYaraSse } from '../../../../../../lib/server/yara-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyYaraSse(`/ai-runs/${encodeURIComponent(id)}/events`, request);
}
