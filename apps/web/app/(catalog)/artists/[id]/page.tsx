import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArtistDetail } from '../../../../features/catalog/artist-detail';
import { decodeCatalogPathId } from '../../../../lib/catalog-id';

export const metadata: Metadata = { title: 'Artist' };

export default async function ArtistDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id: pathId } = await params;
  const id = decodeCatalogPathId(pathId);
  if (!id) notFound();
  return <ArtistDetail id={id} />;
}
