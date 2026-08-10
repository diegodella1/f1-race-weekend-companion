import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const runtime = await getRequestRuntime(request);
  return Response.json(runtime.engine.getHealth());
}
