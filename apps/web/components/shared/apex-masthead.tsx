import Link from 'next/link';
import { ApexIcon } from './apex-icon';

export function ApexBrandBar() {
  return (
    <div className="apex-brand-bar">
      <Link className="apex-brand" href="/weekend" aria-label="F1 Companion live dashboard">
        <span className="apex-brand__mark"><ApexIcon name="speed" /></span>
        <span><b>F1</b><small>Companion</small></span>
      </Link>
      <Link className="apex-live-link" href="/weekend"><i aria-hidden="true" />F1 Live</Link>
      <Link className="apex-icon-button" href="/settings" aria-label="Settings"><ApexIcon name="settings" /></Link>
    </div>
  );
}

export function ApexMasthead() {
  return <header className="apex-masthead"><ApexBrandBar /></header>;
}
