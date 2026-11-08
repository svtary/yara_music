'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navigation = [
  { label: 'Home' },
  { label: 'Explore Music', href: '/explore' },
  { label: 'Talk to Yara', href: '/yara' },
  { label: 'Community' },
  { label: 'Me' },
] as const;

function NavigationItems() {
  const pathname = usePathname();
  return (
    <ul className="catalog-navigation-list">
      {navigation.map((item) => (
        <li key={item.label}>
          {'href' in item ? (
            <Link
              className={`catalog-navigation-link ${pathname.startsWith(item.href) ? 'is-active' : ''}`}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
            >
              <span aria-hidden="true" className="catalog-navigation-dot" />
              {item.label}
            </Link>
          ) : (
            <span className="catalog-navigation-link is-disabled" aria-disabled="true">
              <span aria-hidden="true" className="catalog-navigation-dot" />
              {item.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CatalogShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const currentSection = pathname.startsWith('/yara') ? 'Yara' : 'Explore';
  return (
    <div className={`catalog-shell ${pathname.startsWith('/yara') ? 'is-yara' : ''}`}>
      <aside className="catalog-rail">
        <Link className="catalog-brand" href="/explore" aria-label="Yara Explore">
          <span aria-hidden="true" className="catalog-brand-mark" />
          <span>Yara</span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavigationItems />
        </nav>
      </aside>

      <header className="catalog-mobile-header">
        <Link className="catalog-brand" href="/explore" aria-label="Yara Explore">
          <span aria-hidden="true" className="catalog-brand-mark" />
          <span>Yara</span>
        </Link>
        <span className="catalog-mobile-section">{currentSection}</span>
      </header>

      <main className="catalog-main">{children}</main>

      <nav className="catalog-mobile-navigation" aria-label="Primary navigation">
        <span aria-disabled="true">Home</span>
        <Link href="/explore" aria-current={pathname.startsWith('/explore') ? 'page' : undefined}>
          Explore
        </Link>
        <Link href="/yara" aria-current={pathname.startsWith('/yara') ? 'page' : undefined}>
          Yara
        </Link>
        <span aria-disabled="true">Community</span>
        <span aria-disabled="true">Me</span>
      </nav>
    </div>
  );
}
