'use client';

import { useSearchParams } from 'next/navigation';

import { YaraConversation } from './yara-conversation';
import { YaraHome } from './yara-home';
import { resolveYaraSurface } from './yara-routes';

export function YaraExperience() {
  const conversationId = useSearchParams().get('conversation');
  return resolveYaraSurface(conversationId) === 'conversation' ? (
    <YaraConversation />
  ) : (
    <YaraHome />
  );
}
