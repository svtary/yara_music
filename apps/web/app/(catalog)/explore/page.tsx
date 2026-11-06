import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ExploreSearch } from '../../../features/catalog/explore-search';
import { SearchLoadingState } from '../../../features/catalog/search-states';

export const metadata: Metadata = {
  title: 'Explore music',
};

export default function ExplorePage() {
  return (
    <Suspense fallback={<SearchLoadingState />}>
      <ExploreSearch />
    </Suspense>
  );
}
