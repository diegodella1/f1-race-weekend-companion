import type { DriverState, SessionSnapshot } from '@f1/domain';

export interface CleanLapDeltaPoint {
  lapNumber: number;
  deltaSec: number;
}

export interface SectorLeader {
  sector: number;
  driver: DriverState;
  timeSec: number;
}

export function selectStrategyDrivers(
  snapshot: SessionSnapshot,
  requestedPrimaryId: string | null,
  requestedRivalId: string | null,
  favoriteDriverId: string | null
): [DriverState, DriverState] | null {
  const driversById = new Map(snapshot.drivers.map((driver) => [driver.driverId, driver]));
  const requestedPrimary = requestedPrimaryId ? driversById.get(requestedPrimaryId) : undefined;
  const requestedRival = requestedRivalId ? driversById.get(requestedRivalId) : undefined;
  if (requestedPrimary && requestedRival && requestedPrimary.driverId !== requestedRival.driverId) {
    return [requestedPrimary, requestedRival];
  }

  const favorite = favoriteDriverId ? driversById.get(favoriteDriverId) : undefined;
  const signal = snapshot.strategySignals.find((candidate) => {
    if (!favorite) return true;
    return candidate.driverId === favorite.driverId || candidate.rivalDriverId === favorite.driverId;
  }) ?? snapshot.strategySignals[0];
  if (signal) {
    const signalPrimary = favorite ?? driversById.get(signal.driverId);
    const rivalId = signalPrimary?.driverId === signal.driverId ? signal.rivalDriverId : signal.driverId;
    const signalRival = driversById.get(rivalId);
    if (signalPrimary && signalRival) return [signalPrimary, signalRival];
  }

  const primary = favorite ?? snapshot.drivers[0];
  if (!primary) return null;
  const rival = findNearestRival(snapshot.drivers, primary);
  return rival ? [primary, rival] : null;
}

export function buildCleanLapDeltaSeries(primary: DriverState, rival: DriverState): CleanLapDeltaPoint[] {
  const primaryTimes = new Map(primary.laps.flatMap((lap) => (
    lap.clean && lap.timeSec !== null ? [[lap.lapNumber, lap.timeSec] as const] : []
  )));
  return rival.laps.flatMap((lap) => {
    const primaryTime = primaryTimes.get(lap.lapNumber);
    if (!lap.clean || lap.timeSec === null || primaryTime === undefined) return [];
    return [{ lapNumber: lap.lapNumber, deltaSec: round(lap.timeSec - primaryTime) }];
  });
}

export function findSectorLeaders(drivers: DriverState[]): SectorLeader[] {
  const leaders: Array<SectorLeader | null> = [null, null, null];
  for (const driver of drivers) {
    for (const lap of driver.laps) {
      if (!lap.clean) continue;
      lap.sectorsSec.forEach((timeSec, index) => {
        const current = leaders[index];
        if (timeSec !== null && (!current || timeSec < current.timeSec)) {
          leaders[index] = { sector: index + 1, driver, timeSec };
        }
      });
    }
  }
  return leaders.filter((leader): leader is SectorLeader => leader !== null);
}

function findNearestRival(drivers: DriverState[], primary: DriverState): DriverState | undefined {
  const primaryIndex = drivers.findIndex((driver) => driver.driverId === primary.driverId);
  if (primaryIndex < 0) return undefined;
  return drivers[primaryIndex + 1] ?? drivers[primaryIndex - 1];
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
