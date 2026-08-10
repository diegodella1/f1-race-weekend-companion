'use client';

import { useEffect, useRef, useState } from 'react';
import type { Insight } from '@f1/domain';
import { confidenceLabel } from '@/lib/format';
import { trackEvent } from '@/lib/client/analytics';

export function ExplainSheet({ insights }: { insights: Insight[] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  function openSheet() {
    setOpen(true);
    trackEvent('explain_opened');
  }
  return (
    <>
      <button className="explain-trigger" type="button" onClick={openSheet}>
        <span><small>WHAT MATTERS NOW</small><strong>{insights[0]?.headline ?? 'Race context is building'}</strong></span>
        <b>{insights.length}</b>
      </button>
      <dialog ref={dialogRef} className="explain-dialog" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-labelledby="explain-title">
        <div className="dialog-handle" aria-hidden="true" />
        <div className="panel-heading"><div><p className="eyebrow">DETERMINISTIC EXPLAIN</p><h2 id="explain-title">What matters now</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></div>
        {insights.length === 0 ? <p className="empty-copy">No high-impact change right now. Timing remains stable.</p> : (
          <ol className="insight-list">
            {insights.map((insight) => (
              <li key={insight.id}>
                <div><span>{insight.type.replace('_', ' ')}</span><b>{confidenceLabel(insight.confidence)}</b></div>
                <h3>{insight.headline}</h3>
                <ul>{insight.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
                <time>Updated {new Date(insight.updatedAt).toLocaleTimeString()}</time>
              </li>
            ))}
          </ol>
        )}
      </dialog>
    </>
  );
}
