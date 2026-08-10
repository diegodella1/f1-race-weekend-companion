import type { SessionPatch, SessionSnapshot } from '@f1/domain';

export function applySessionPatch(current: SessionSnapshot, patch: SessionPatch): SessionSnapshot | null {
  if (patch.baseRevision !== current.revision) return null;
  const driverUpdates = new Map((patch.drivers ?? []).map((driver) => [driver.driverId, driver]));
  const existingRaceControl = new Set(current.raceControl.map((event) => event.id));
  const appendedRaceControl = (patch.raceControlAppend ?? []).filter((event) => !existingRaceControl.has(event.id));
  return {
    ...current,
    ...patch.session,
    revision: patch.revision,
    drivers: current.drivers.map((driver) => driverUpdates.get(driver.driverId) ?? driver),
    raceControl: [...current.raceControl, ...appendedRaceControl],
    battles: patch.battles ?? current.battles,
    pitProjections: patch.pitProjections ?? current.pitProjections,
    strategySignals: patch.strategySignals ?? current.strategySignals,
    insights: patch.insights ?? current.insights,
    meta: patch.meta ?? current.meta
  };
}
