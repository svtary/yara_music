import { proxyYaraJson } from '../../../../../lib/server/yara-proxy';

export async function POST(request: Request) {
  return proxyYaraJson('/conversations/start', {
    method: 'POST',
    body: await request.text(),
  });
}
