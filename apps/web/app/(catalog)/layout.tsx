import type { ReactNode } from 'react';

import { CatalogShell } from '../../components/layout/catalog-shell';

export default function CatalogProductLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <CatalogShell>{children}</CatalogShell>;
}
