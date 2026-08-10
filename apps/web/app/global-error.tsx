'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main className="center-state"><p className="eyebrow">SESSION ERROR</p><h1>Timing hit a problem</h1><p>{error.message}</p>{error.digest ? <code>Request {error.digest}</code> : null}<button type="button" onClick={reset}>Retry</button></main></body></html>;
}
