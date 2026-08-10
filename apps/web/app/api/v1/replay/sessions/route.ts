import { errorResponse } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (process.env.ENABLE_REPLAY === 'false') return Response.json({ sessions: [] });
    const runtime = await getRequestRuntime(request);
    const replayMeeting = runtime.replayAdapter.getMeeting();
    return Response.json({
      sessions: replayMeeting.sessions.filter((session) => session.kind === 'race'),
      state: runtime.replayAdapter.getState()
    });
  } catch (error) {
    return errorResponse(error);
  }
}
