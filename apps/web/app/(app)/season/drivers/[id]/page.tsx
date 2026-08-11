import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApexScreen } from '@/components/shared/apex-screen';
import { getSeasonCatalog } from '@/lib/server/season-catalog';
import { decodeRouteId } from '@/lib/server/route-params';

export const dynamic = 'force-dynamic';

export default async function DriverProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, catalog] = await Promise.all([params, getSeasonCatalog()]);
  const decodedId = decodeRouteId(id);
  const driver = catalog.drivers.find((candidate) => candidate.id === decodedId);
  if (!driver) notFound();
  const team = catalog.teams.find((candidate) => candidate.id === driver.teamId);
  const teammate = catalog.drivers.find((candidate) => candidate.teamId === driver.teamId && candidate.id !== driver.id);
  return (
    <ApexScreen>
      <main className="page-frame season-detail driver-profile" style={{ '--team-color': driver.teamColor } as CSSProperties}>
        <Link className="back-link" href="/season?view=drivers">← All 2026 drivers</Link>
        <header><span>{driver.number}</span><div><p className="eyebrow">{driver.code} · 2026 DRIVER</p><h1>{driver.firstName}<strong>{driver.lastName}</strong></h1><p>{driver.countryCode ?? 'Nationality unavailable'}</p></div></header>
        <dl className="profile-facts"><div><dt>Team</dt><dd>{team ? <Link href={`/season/teams/${encodeURIComponent(team.id)}`}>{team.name}</Link> : driver.teamName}</dd></div><div><dt>Race number</dt><dd>{driver.number}</dd></div><div><dt>Code</dt><dd>{driver.code}</dd></div><div><dt>Teammate</dt><dd>{teammate ? <Link href={`/season/drivers/${encodeURIComponent(teammate.id)}`}>{teammate.fullName}</Link> : 'Unavailable'}</dd></div></dl>
      </main>
    </ApexScreen>
  );
}
