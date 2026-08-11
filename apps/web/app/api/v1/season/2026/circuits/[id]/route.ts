import { errorResponse, enforceRateLimit, HttpError } from '@/lib/server/http';
import { getSeasonCatalog } from '@/lib/server/season-catalog';
import { decodeRouteId } from '@/lib/server/route-params';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request);
    const { id } = await params;
    const catalog = await getSeasonCatalog();
    const decodedId = decodeRouteId(id);
    const circuit = catalog.circuits.find((candidate) => candidate.id === decodedId);
    if (!circuit) throw new HttpError('CIRCUIT_NOT_FOUND', 'Circuit not found', false, 404);
    return Response.json({ circuit, events: catalog.events.filter((event) => event.circuitId === decodedId) });
  } catch (error) {
    return errorResponse(error);
  }
}
