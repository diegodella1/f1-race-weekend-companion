import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApexScreen } from '@/components/shared/apex-screen';
import { DriverCatalog } from '@/components/season/season-cards';
import { getSeasonCatalog } from '@/lib/server/season-catalog';
import { decodeRouteId } from '@/lib/server/route-params';

export const dynamic = 'force-dynamic';

export default async function TeamProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, catalog] = await Promise.all([params, getSeasonCatalog()]);
  const decodedId = decodeRouteId(id);
  const team = catalog.teams.find((candidate) => candidate.id === decodedId);
  if (!team) notFound();
  const driverIds = new Set(team.driverIds);
  const drivers = catalog.drivers.filter((driver) => driverIds.has(driver.id));
  return (
    <ApexScreen>
      <main className="page-frame season-detail team-profile" style={{ '--team-color': team.color } as CSSProperties}>
        <Link className="back-link" href="/season?view=teams">← All 2026 teams</Link>
        <header><p className="eyebrow">2026 CONSTRUCTOR · 2 DRIVERS</p><h1>{team.name}</h1><i aria-hidden="true" /></header>
        <section><p className="eyebrow">OFFICIAL ENTRY</p><h2>Driver line-up</h2><DriverCatalog drivers={drivers} /></section>
      </main>
    </ApexScreen>
  );
}
