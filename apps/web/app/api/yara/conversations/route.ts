import { proxyYaraJson } from '../../../../lib/server/yara-proxy';

export async function GET(request: Request) {
  const limit = new URL(request.url).searchParams.get('limit');
  return proxyYaraJson(`/conversations${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`);
}

export async function POST() {
  return proxyYaraJson('/conversations', { method: 'POST' });
}
