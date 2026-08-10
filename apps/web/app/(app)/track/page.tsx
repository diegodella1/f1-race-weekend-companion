import Image from 'next/image';
import Link from 'next/link';
import { Metric } from '@f1/ui';
import { getServerRuntime } from '@/lib/server/runtime';

export default async function TrackPage() {
  const { track, meeting } = await getServerRuntime();
  return <main className="page-frame track-page"><Link className="back-link" href="/weekend">← Live timing</Link><p className="eyebrow">{meeting.countryCode} · CIRCUIT CONTEXT</p><h1>{track.name}</h1><div className="track-layout"><div className="track-map">{track.layoutPath ? <Image src={track.layoutPath} alt={`Simplified layout of ${track.name}`} width={720} height={440} priority/> : <p>Layout unavailable</p>}</div><div className="track-metrics"><Metric label="Length" value={track.lengthKm === null ? 'Unavailable' : `${track.lengthKm.toFixed(3)} km`}/><Metric label="Race distance" value={track.laps === null ? 'Unavailable' : `${track.laps} laps`}/><Metric label="Pit loss" value={track.pitLossSec ? `~${track.pitLossSec.toFixed(1)}s` : 'Unavailable'} detail="estimated"/><Metric label="DRS zones" value={track.drsZones.length || 'Unavailable'}/></div></div><section className="surface track-zones"><h2>Detection zones</h2>{track.drsZones.length ? <ol>{track.drsZones.map((zone, index) => <li key={zone}><b>DRS {index + 1}</b><span>{zone}</span></li>)}</ol> : <p>DRS zone data unavailable from provider.</p>}<p>Weather appears only when supplied by active weekend feed.</p></section></main>;
}
