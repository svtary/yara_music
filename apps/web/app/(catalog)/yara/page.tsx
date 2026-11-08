import type { Metadata } from 'next';
import { Suspense } from 'react';

import { YaraExperience } from '../../../features/yara/yara-experience';

export const metadata: Metadata = {
  title: 'Talk to Yara',
  description: 'A focused, streaming conversation with Yara.',
};

export default function YaraPage() {
  return (
    <Suspense fallback={<div className="yara-page-loading">Opening Yara…</div>}>
      <YaraExperience />
    </Suspense>
  );
}
