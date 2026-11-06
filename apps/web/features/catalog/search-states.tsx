import { Button, Skeleton } from 'antd';

import { ErrorState } from '../../components/ui/async-state';

export function SearchIdleState() {
  return (
    <section className="catalog-idle-state" aria-labelledby="search-idle-heading">
      <span className="catalog-object-label">Discover</span>
      <h2 id="search-idle-heading">Start with a name, an album, or a track.</h2>
      <p>Yara searches its canonical music catalog and keeps every object distinct.</p>
    </section>
  );
}

export function SearchLoadingState() {
  return (
    <div className="catalog-search-skeleton" aria-label="Searching the music catalog" role="status">
      <Skeleton active paragraph={{ rows: 1 }} title={{ width: '32%' }} />
      <Skeleton active paragraph={{ rows: 2 }} title={false} />
      <Skeleton active paragraph={{ rows: 2 }} title={false} />
    </div>
  );
}

export function SearchEmptyState({ query }: Readonly<{ query: string }>) {
  return (
    <section className="catalog-empty-state" role="status">
      <span className="catalog-object-label">No matches</span>
      <h2>Nothing surfaced for “{query}”</h2>
      <p>Check the spelling or try a different artist, album, or recording.</p>
    </section>
  );
}

export function SearchErrorState({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <ErrorState
      title="Search is unavailable"
      description="Yara could not reach the music catalog. Your query is still here."
      onRetry={onRetry}
    />
  );
}

export function ClearSearchButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <Button className="catalog-clear-search" type="text" onClick={onClick}>
      Clear
    </Button>
  );
}
