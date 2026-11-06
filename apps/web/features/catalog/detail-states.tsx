'use client';

import { Button, Skeleton } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ErrorState } from '../../components/ui/async-state';

export function CatalogBackButton() {
  const router = useRouter();

  return (
    <Button
      className="catalog-back-button"
      type="text"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push('/explore');
      }}
    >
      <span aria-hidden="true">←</span> Back
    </Button>
  );
}

export function DetailLoadingState() {
  return (
    <div className="catalog-detail-loading" aria-label="Loading music detail" role="status">
      <Skeleton.Button active size="small" />
      <div className="catalog-detail-loading-hero">
        <Skeleton.Image active />
        <Skeleton active paragraph={{ rows: 3 }} title={{ width: '55%' }} />
      </div>
      <Skeleton active paragraph={{ rows: 4 }} title={{ width: '25%' }} />
    </div>
  );
}

export function DetailNotFoundState({ objectName }: Readonly<{ objectName: string }>) {
  return (
    <section className="catalog-not-found" aria-labelledby="not-found-title">
      <span className="catalog-object-label">Not found</span>
      <h1 id="not-found-title">This {objectName} is not in Yara’s catalog.</h1>
      <p>The canonical reference may be invalid or the object may no longer be available.</p>
      <Button type="primary" href="/explore">
        Return to Explore
      </Button>
    </section>
  );
}

export function DetailErrorState({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div className="catalog-detail-error">
      <ErrorState
        title="This music could not load"
        description="The catalog is temporarily unavailable. Try again without losing your place."
        onRetry={onRetry}
      />
      <Link href="/explore">Return to Explore</Link>
    </div>
  );
}
