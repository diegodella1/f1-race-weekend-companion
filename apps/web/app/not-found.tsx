import Link from 'next/link';

export default function NotFound() {
  return <main className="center-state"><p className="eyebrow">404 · OFF TRACK</p><h1>Nothing at this position</h1><Link className="primary-action" href="/weekend">Return to live timing</Link></main>;
}
