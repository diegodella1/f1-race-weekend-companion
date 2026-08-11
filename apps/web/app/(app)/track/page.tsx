import Image from 'next/image';
import { Metric } from '@f1/ui';
import { ApexScreen } from '@/components/shared/apex-screen';
import { getServerRuntime } from '@/lib/server/runtime';
import { findSectorLeaders } from '@/lib/strategy-view';
import { formatLapTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TrackPage() {
  const runtime = await getServerRuntime();
  const { track, meeting } = runtime;
  const session = meeting.sessions.find((candidate) => candidate.kind === 'race') ?? meeting.sessions[0];
  const snapshot = session ? await runtime.engine.getSnapshot(session.id, { delaySeconds: 0, favoriteDriverId: null }) : null;
  const sectorLeaders = snapshot ? findSectorLeaders(snapshot.drivers) : [];
  return (
    <ApexScreen>
      <main className="page-frame track-page">
        <p className="eyebrow">{meeting.countryCode} · CIRCUIT INTELLIGENCE</p><h1>{track.name}</h1>
        <div className="track-layout"><div className="track-map">{track.layoutPath ? <Image src={track.layoutPath} alt={`Simplified layout of ${track.name}`} width={720} height={440} priority/> : <p>Layout unavailable</p>}</div><div className="track-metrics"><Metric label="Length" value={track.lengthKm === null ? 'Unavailable' : `${track.lengthKm.toFixed(3)} km`}/><Metric label="Race distance" value={track.laps === null ? 'Unavailable' : `${track.laps} laps`}/><Metric label="Pit loss" value={track.pitLossSec ? `~${track.pitLossSec.toFixed(1)}s` : 'Unavailable'} detail="estimated"/><Metric label="DRS zones" value={track.drsZones.length || 'Unavailable'}/></div></div>
        <div className="track-context-grid">
          <section className="surface track-zones"><div className="panel-heading"><div><p className="eyebrow">CIRCUIT DATA</p><h2>DRS detection zones</h2></div><span>{track.drsZones.length}</span></div>{track.drsZones.length ? <ol>{track.drsZones.map((zone, index) => <li key={zone}><b>DRS {index + 1}</b><span>{zone}</span></li>)}</ol> : <p className="empty-copy">DRS zone data unavailable from provider.</p>}</section>
          <section className="surface sector-leaders"><div className="panel-heading"><div><p className="eyebrow">CLEAN LAPS</p><h2>Sector leaders</h2></div><span>{sectorLeaders.length}</span></div>{sectorLeaders.length ? <ol>{sectorLeaders.map((leader) => <li key={leader.sector}><span>S{leader.sector}</span><b>{leader.driver.code}</b><strong>{formatLapTime(leader.timeSec)}</strong></li>)}</ol> : <p className="empty-copy">Sector leaders appear after valid clean laps are supplied.</p>}</section>
        </div>
      </main>
    </ApexScreen>
  );
}
