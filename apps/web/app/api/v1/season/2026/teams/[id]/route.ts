import { errorResponse, enforceRateLimit, HttpError } from '@/lib/server/http';
import { getSeasonCatalog } from '@/lib/server/season-catalog';
import { decodeRouteId } from '@/lib/server/route-params';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    enforceRateLimit(request);
    const { id } = await params;
    const catalog = await getSeasonCatalog();
    const team = catalog.teams.find((candidate) => candidate.id === decodeRouteId(id));
    if (!team) throw new HttpError('TEAM_NOT_FOUND', 'Team not found', false, 404);
    const driverIds = new Set(team.driverIds);
    return Response.json({ team, drivers: catalog.drivers.filter((driver) => driverIds.has(driver.id)) });
  } catch (error) {
    return errorResponse(error);
  }
}
