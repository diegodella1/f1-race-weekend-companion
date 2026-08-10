import type { ComponentProps, ReactNode } from 'react';

export function Surface({ className = '', ...props }: ComponentProps<'section'>) {
  return <section className={`surface ${className}`.trim()} {...props} />;
}

export function StatusPill({ tone, children }: { tone: 'green' | 'yellow' | 'red' | 'muted'; children: ReactNode }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
      {detail === undefined ? null : <span className="metric__detail">{detail}</span>}
    </div>
  );
}
