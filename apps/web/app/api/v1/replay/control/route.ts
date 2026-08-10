import { z } from 'zod';
import { errorResponse, HttpError } from '@/lib/server/http';
import { getRequestRuntime } from '@/lib/server/runtime';

const replayControlSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('play'), sessionId: z.string() }),
  z.object({ action: z.literal('pause'), sessionId: z.string() }),
  z.object({ action: z.literal('reset'), sessionId: z.string() }),
  z.object({ action: z.literal('seek'), sessionId: z.string(), atMs: z.number().int().nonnegative() }),
  z.object({ action: z.literal('speed'), sessionId: z.string(), speed: z.union([z.literal(1), z.literal(4), z.literal(16)]) })
]);

export async function POST(request: Request) {
  try {
    if (process.env.ENABLE_REPLAY === 'false') throw new HttpError('REPLAY_DISABLED', 'Replay is disabled', false, 404);
    const control = replayControlSchema.parse(await request.json());
    const runtime = await getRequestRuntime(request);
    if (control.sessionId !== runtime.replayAdapter.getMeeting().sessions.find((session) => session.kind === 'race')?.id) {
      throw new HttpError('SESSION_NOT_FOUND', 'Replay session not found', false, 404);
    }
    if (control.action === 'play') runtime.replayAdapter.play();
    if (control.action === 'pause') runtime.replayAdapter.pause();
    if (control.action === 'reset') runtime.replayAdapter.reset();
    if (control.action === 'seek') runtime.replayAdapter.seek(control.atMs);
    if (control.action === 'speed') runtime.replayAdapter.setSpeed(control.speed);
    return Response.json(runtime.replayAdapter.getState());
  } catch (error) {
    return errorResponse(error);
  }
}
