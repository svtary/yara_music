import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AlbumDetail } from '../../../../features/catalog/album-detail';
import { decodeCatalogPathId } from '../../../../lib/catalog-id';

export const metadata: Metadata = { title: 'Album' };

export default async function AlbumDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id: pathId } = await params;
  const id = decodeCatalogPathId(pathId);
  if (!id) notFound();
  return <AlbumDetail id={id} />;
}
