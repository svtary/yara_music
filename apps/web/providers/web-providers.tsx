import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { ReactNode } from 'react';

import { ClientProviders } from './client-providers';

export function WebProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AntdRegistry>
      <ClientProviders>{children}</ClientProviders>
    </AntdRegistry>
  );
}
