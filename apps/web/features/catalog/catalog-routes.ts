export type CatalogRouteKind = 'artist' | 'album' | 'recording';

const routeSegment: Record<CatalogRouteKind, string> = {
  artist: 'artists',
  album: 'albums',
  recording: 'recordings',
};

export function catalogDetailHref(kind: CatalogRouteKind, canonicalId: string): string {
  return `/${routeSegment[kind]}/${encodeURIComponent(canonicalId)}`;
}

export function normalizeSearchQuery(value: string): string {
  return value.trim().slice(0, 120);
}

export function exploreHref(query: string): string {
  const normalized = normalizeSearchQuery(query);
  return normalized ? `/explore?q=${encodeURIComponent(normalized)}` : '/explore';
}
