import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { RecordingDetail } from '../../../../features/catalog/recording-detail';
import { decodeCatalogPathId } from '../../../../lib/catalog-id';

export const metadata: Metadata = { title: 'Recording' };

export default async function RecordingDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id: pathId } = await params;
  const id = decodeCatalogPathId(pathId);
  if (!id) notFound();
  return <RecordingDetail id={id} />;
}
