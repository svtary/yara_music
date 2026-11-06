import type { CatalogSearchResultContract } from '@yara/contracts';

export type SearchViewState = 'idle' | 'loading' | 'error' | 'empty' | 'results';
export type DetailViewState = 'loading' | 'not-found' | 'error' | 'ready';

export function resolveSearchViewState(input: {
  readonly query: string;
  readonly isPending: boolean;
  readonly hasError: boolean;
  readonly results: readonly CatalogSearchResultContract[] | undefined;
}): SearchViewState {
  if (!input.query) return 'idle';
  if (input.isPending) return 'loading';
  if (input.hasError) return 'error';
  if (!input.results || input.results.length === 0) return 'empty';
  return 'results';
}

export function resolveDetailViewState(input: {
  readonly isPending: boolean;
  readonly errorStatus?: number | undefined;
  readonly hasData: boolean;
}): DetailViewState {
  if (input.isPending) return 'loading';
  if (input.errorStatus === 404) return 'not-found';
  if (input.errorStatus !== undefined || !input.hasData) return 'error';
  return 'ready';
}
