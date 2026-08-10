import type { SessionSnapshot, StreamEvent } from '@f1/domain';
import { getRequestRuntime } from '@/lib/server/runtime';
import { parseDelay } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 240;

const encoder = new TextEncoder();

function encodeEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`event: ${event.type}\nid: ${event.revision}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const delaySeconds = parseDelay(searchParams);
  const favoriteDriverId = searchParams.get('favorite');
  const runtime = await getRequestRuntime(request);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void pumpStream(controller, request.signal, runtime, id, delaySeconds, favoriteDriverId);
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}

async function pumpStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal,
  runtime: Awaited<ReturnType<typeof getRequestRuntime>>,
  sessionId: string,
  delaySeconds: number,
  favoriteDriverId: string | null
): Promise<void> {
  let previous: SessionSnapshot | null = null;
  let ticks = 0;
  const startedAt = Date.now();
  try {
    while (!signal.aborted && Date.now() - startedAt < 230_000) {
      const snapshot = await runtime.engine.getSnapshot(sessionId, { delaySeconds, favoriteDriverId });
      if (!previous) {
        controller.enqueue(encodeEvent({ type: 'snapshot', revision: snapshot.revision, data: snapshot }));
      } else if (snapshot.revision !== previous.revision) {
        controller.enqueue(encodeEvent({
          type: 'patch',
          revision: snapshot.revision,
          data: runtime.engine.createPatch(previous, snapshot)
        }));
      }
      if (ticks % 5 === 0) {
        controller.enqueue(encodeEvent({ type: 'health', revision: snapshot.revision, data: runtime.engine.getHealth() }));
      }
      if (ticks % 15 === 0) {
        controller.enqueue(encodeEvent({
          type: 'heartbeat',
          revision: snapshot.revision,
          data: { at: new Date().toISOString() }
        }));
      }
      previous = snapshot;
      ticks += 1;
      await wait(1_000, signal);
    }
  } catch {
    if (!signal.aborted) {
      controller.enqueue(encodeEvent({ type: 'health', revision: previous?.revision ?? 0, data: runtime.engine.getHealth() }));
    }
  } finally {
    if (!signal.aborted) controller.close();
  }
}
