import { decodeCatalogPathId } from '../../../../../lib/catalog-id';
import { proxyCatalogRead } from '../../../../../lib/server/catalog-proxy';

export async function GET(
  _request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id: pathId } = await context.params;
  const id = decodeCatalogPathId(pathId);
  if (!id) return new Response(null, { status: 400 });
  return proxyCatalogRead(`/artists/${encodeURIComponent(id)}`);
}
