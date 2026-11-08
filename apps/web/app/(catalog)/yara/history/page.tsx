import type { Metadata } from 'next';

import { YaraHistory } from '../../../../features/yara/yara-history';

export const metadata: Metadata = {
  title: 'Conversation history',
  description: 'Resume your recent Yara conversations.',
};

export default function YaraHistoryPage() {
  return <YaraHistory />;
}
