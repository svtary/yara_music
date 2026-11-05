import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { WebProviders } from '../providers/web-providers';

import './styles.css';

export const metadata: Metadata = {
  title: 'Yara · Web Foundation',
  description: 'Yara MVP-0 Web UI foundation development shell',
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
