import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { CircuitProfile, DriverProfile, SeasonEvent, TeamProfile } from '@f1/domain';
import { OfficialCircuitImage } from './official-circuit-image';

export function CircuitCatalog({ circuits, events }: { circuits: CircuitProfile[]; events: SeasonEvent[] }) {
  const eventsByCircuit = new Map(events.map((event) => [event.circuitId, event]));
  return (
    <ol className="season-grid season-grid--circuits">
      {circuits.map((circuit, index) => {
        const event = eventsByCircuit.get(circuit.id);
        return (
          <li key={circuit.id}>
            <Link className="circuit-card" href={`/season/circuits/${encodeURIComponent(circuit.id)}`}>
              <span className="circuit-card__round">{String(index + 1).padStart(2, '0')}</span>
              <div className="circuit-card__map"><OfficialCircuitImage imageUrl={circuit.layoutImageUrl} name={circuit.name} verified={circuit.layoutStatus === 'verified'} /></div>
              <div className="circuit-card__copy">
                <small>{circuit.countryCode} · {circuit.type}</small>
                <h2>{circuit.name}</h2>
                <p>{circuit.location}</p>
                <StatusTag status={event?.status} />
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function DriverCatalog({ drivers }: { drivers: DriverProfile[] }) {
  return (
    <ol className="season-grid season-grid--drivers">
      {drivers.map((driver) => (
        <li key={driver.id} style={{ '--team-color': driver.teamColor } as CSSProperties}>
          <Link className="driver-card" href={`/season/drivers/${encodeURIComponent(driver.id)}`}>
            <span className="driver-card__number">{driver.number}</span>
            <small>{driver.teamName}</small>
            <h2>{driver.firstName}<strong>{driver.lastName}</strong></h2>
            <span className="driver-card__code">{driver.code}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function TeamCatalog({ teams, drivers }: { teams: TeamProfile[]; drivers: DriverProfile[] }) {
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  return (
    <ol className="season-grid season-grid--teams">
      {teams.map((team) => (
        <li key={team.id} style={{ '--team-color': team.color } as CSSProperties}>
          <Link className="team-card" href={`/season/teams/${encodeURIComponent(team.id)}`}>
            <small>2026 CONSTRUCTOR</small>
            <h2>{team.name}</h2>
            <div>{team.driverIds.map((id) => <span key={id}>{driversById.get(id)?.fullName ?? 'Driver unavailable'}</span>)}</div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function StatusTag({ status }: { status: SeasonEvent['status'] | undefined }) {
  if (!status) return null;
  return <span className={`event-state event-state--${status}`}>{status}</span>;
}
