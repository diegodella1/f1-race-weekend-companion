import { errorResponse, enforceRateLimit, HttpError } from '@/lib/server/http';
import { getSeasonCatalog } from '@/lib/server/season-catalog';
import { decodeRouteId } from '@/lib/server/route-params';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request);
    const { id } = await params;
    const catalog = await getSeasonCatalog();
    const driver = catalog.drivers.find((candidate) => candidate.id === decodeRouteId(id));
    if (!driver) throw new HttpError('DRIVER_NOT_FOUND', 'Driver not found', false, 404);
    const team = catalog.teams.find((candidate) => candidate.id === driver.teamId) ?? null;
    return Response.json({ driver, team });
  } catch (error) {
    return errorResponse(error);
  }
}
