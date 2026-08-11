import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApexScreen } from '@/components/shared/apex-screen';
import { OfficialCircuitImage } from '@/components/season/official-circuit-image';
import { getSeasonCatalog } from '@/lib/server/season-catalog';
import { decodeRouteId } from '@/lib/server/route-params';

export const dynamic = 'force-dynamic';

export default async function CircuitProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, catalog] = await Promise.all([params, getSeasonCatalog()]);
  const decodedId = decodeRouteId(id);
  const circuit = catalog.circuits.find((candidate) => candidate.id === decodedId);
  if (!circuit) notFound();
  const events = catalog.events.filter((event) => event.circuitId === circuit.id);
  return (
    <ApexScreen>
      <main className="page-frame season-detail circuit-profile">
        <Link className="back-link" href="/season?view=circuits">← All 2026 circuits</Link>
        <header><p className="eyebrow">{circuit.countryCode} · CIRCUIT {circuit.circuitKey}</p><h1>{circuit.name}</h1><p>{circuit.location}, {circuit.countryName} · {circuit.type}</p></header>
        <section className="official-map-panel" aria-labelledby="official-map-title">
          <div><p className="eyebrow">VERIFIED ASSET</p><h2 id="official-map-title">Official circuit map</h2><span className={`map-verification map-verification--${circuit.layoutStatus}`}>{circuit.layoutStatus}</span></div>
          <div className="official-map-stage"><OfficialCircuitImage imageUrl={circuit.layoutImageUrl} name={circuit.name} verified={circuit.layoutStatus === 'verified'} priority /></div>
          {circuit.layoutSourceUrl ? <a href={circuit.layoutSourceUrl} rel="noreferrer">Open original Formula 1 asset ↗</a> : <p>Official source unavailable. No substitute drawing is rendered.</p>}
        </section>
        <section className="season-event-panel"><p className="eyebrow">2026 CALENDAR</p><h2>Grand Prix record</h2>{events.map((event) => <article key={event.id}><span className={`event-state event-state--${event.status}`}>{event.status}</span><h3>{event.name}</h3><time dateTime={event.startsAt}>{formatDate(event.startsAt)} — {formatDate(event.endsAt)}</time></article>)}</section>
      </main>
    </ApexScreen>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(value));
}
