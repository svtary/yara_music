'use client';

import { Button, Input } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { useCatalogSearch } from './catalog-queries';
import { exploreHref, normalizeSearchQuery } from './catalog-routes';
import { SearchResults } from './search-results';
import {
  ClearSearchButton,
  SearchEmptyState,
  SearchErrorState,
  SearchIdleState,
  SearchLoadingState,
} from './search-states';
import { resolveSearchViewState } from './catalog-view-state';

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

export function ExploreSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = normalizeSearchQuery(searchParams.get('q') ?? '');
  const [input, setInput] = useState(urlQuery);
  const [userEdited, setUserEdited] = useState(false);
  const previousUrlQuery = useRef(urlQuery);
  const debouncedInput = useDebouncedValue(input, 320);

  useEffect(() => {
    if (previousUrlQuery.current !== urlQuery) {
      previousUrlQuery.current = urlQuery;
      setInput(urlQuery);
      setUserEdited(false);
    }
  }, [urlQuery]);

  useEffect(() => {
    if (!userEdited) return;
    const nextQuery = normalizeSearchQuery(debouncedInput);
    if (nextQuery === urlQuery) return;
    router.replace(exploreHref(nextQuery), { scroll: false });
  }, [debouncedInput, router, urlQuery, userEdited]);

  const search = useCatalogSearch(urlQuery);
  const state = resolveSearchViewState({
    query: urlQuery,
    isPending: search.isPending,
    hasError: search.isError,
    results: search.data,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = normalizeSearchQuery(input);
    setUserEdited(false);
    router.push(exploreHref(nextQuery), { scroll: false });
  }

  function clear() {
    setInput('');
    setUserEdited(false);
    router.push(pathname, { scroll: false });
  }

  return (
    <div className="catalog-page catalog-search-page">
      <header className="catalog-page-header">
        <div>
          <span className="catalog-object-label">Explore</span>
          <h1>{urlQuery ? 'Search results' : 'Find the music in mind'}</h1>
          <p>
            {urlQuery
              ? 'Artists, albums, and recordings remain distinct while one query crosses music.'
              : 'Search Yara’s canonical catalog without leaving the music behind.'}
          </p>
        </div>
      </header>

      <form className="catalog-search-form" role="search" onSubmit={submit}>
        <label htmlFor="catalog-search-input">Search music</label>
        <div className="catalog-search-control">
          <Input
            id="catalog-search-input"
            value={input}
            maxLength={120}
            placeholder="Search artists, albums, recordings"
            autoComplete="off"
            aria-describedby="catalog-search-help"
            onChange={(event) => {
              setInput(event.target.value);
              setUserEdited(true);
            }}
          />
          {input ? <ClearSearchButton onClick={clear} /> : null}
          <Button htmlType="submit" type="primary" disabled={!normalizeSearchQuery(input)}>
            Search
          </Button>
        </div>
        <span id="catalog-search-help">Try “Radiohead”, “OK Computer”, or “Airbag”.</span>
      </form>

      {search.isFetching && !search.isPending ? (
        <p className="catalog-refresh-status" role="status">
          Updating results…
        </p>
      ) : null}

      <div className="catalog-search-content">
        {state === 'idle' ? <SearchIdleState /> : null}
        {state === 'loading' ? <SearchLoadingState /> : null}
        {state === 'error' ? <SearchErrorState onRetry={() => void search.refetch()} /> : null}
        {state === 'empty' ? <SearchEmptyState query={urlQuery} /> : null}
        {state === 'results' && search.data ? <SearchResults results={search.data} /> : null}
      </div>
    </div>
  );
}
