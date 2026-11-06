import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { WebProviders } from '../providers/web-providers';

import './styles.css';

export const metadata: Metadata = {
  title: {
    default: 'Yara · Explore music',
    template: '%s · Yara',
  },
  description: 'Explore canonical artists, albums, and recordings with Yara.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WebProviders>{children}</WebProviders>
      </body>
    </html>
  );
}
