import Link from 'next/link';
import type { ReactNode } from 'react';

const navigation = ['Home', 'Explore Music', 'Talk to Yara', 'Community', 'Me'] as const;

function NavigationItems() {
  return (
    <ul className="catalog-navigation-list">
      {navigation.map((item) => (
        <li key={item}>
          {item === 'Explore Music' ? (
            <Link className="catalog-navigation-link is-active" href="/explore" aria-current="page">
              <span aria-hidden="true" className="catalog-navigation-dot" />
              {item}
            </Link>
          ) : (
            <span className="catalog-navigation-link is-disabled" aria-disabled="true">
              <span aria-hidden="true" className="catalog-navigation-dot" />
              {item}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CatalogShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="catalog-shell">
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
        <span className="catalog-mobile-section">Explore</span>
      </header>

      <main className="catalog-main">{children}</main>

      <nav className="catalog-mobile-navigation" aria-label="Primary navigation">
        <span aria-disabled="true">Home</span>
        <Link href="/explore" aria-current="page">
          Explore
        </Link>
        <span aria-disabled="true">Yara</span>
        <span aria-disabled="true">Community</span>
        <span aria-disabled="true">Me</span>
      </nav>
    </div>
  );
}
