import { errorResponse, enforceRateLimit } from '@/lib/server/http';
import { getSeasonCatalog } from '@/lib/server/season-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    enforceRateLimit(request);
    return Response.json(await getSeasonCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}
