import { heuristicConfig } from './config';
import type {
  Battle,
  Confidence,
  DriverState,
  Lap,
  PitProjection,
  StrategySignal,
  SessionKind,
  TrackStatusCode
} from './models';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const left = sorted[middle - 1];
  const right = sorted[middle];
  if (right === undefined) return 0;
  return sorted.length % 2 === 0 && left !== undefined ? (left + right) / 2 : right;
}

export function markCleanLaps(laps: Lap[], kind: SessionKind): Lap[] {
  const acceptedTimes: number[] = [];
  return laps.map((lap) => {
    const reasons: string[] = [];
    if (lap.timeSec === null || lap.timeSec <= 0) reasons.push('invalid_time');
    if (lap.lapNumber === 1) reasons.push('first_lap');
    if (lap.isPitIn) reasons.push('pit_in');
    if (lap.isPitOut) reasons.push('pit_out');
    if (['SC', 'VSC', 'RED'].includes(lap.trackStatus)) reasons.push('neutralized');
    if (lap.trackStatus === 'YELLOW') reasons.push('yellow_flag');

    if (reasons.length === 0 && lap.timeSec !== null && acceptedTimes.length >= 3) {
      const recentMedian = median(acceptedTimes.slice(-7));
      const threshold = kind === 'practice' ? heuristicConfig.cleanLapOutlierPractice : heuristicConfig.cleanLapOutlierRace;
      if (lap.timeSec > recentMedian * threshold) reasons.push('pace_outlier');
    }

    const clean = reasons.length === 0;
    if (clean && lap.timeSec !== null) acceptedTimes.push(lap.timeSec);
    return { ...lap, clean, exclusionReasons: reasons };
  });
}

export function calculatePace(laps: Lap[], count: 3 | 5): { value: number | null; sampleSize: number } {
  const values = laps
    .filter((lap) => lap.clean && lap.timeSec !== null)
    .slice(-count)
    .map((lap) => lap.timeSec as number);
  if (values.length < 3) return { value: null, sampleSize: values.length };
  const sample = count === 5 && values.length === 5
    ? [...values].sort((a, b) => a - b).slice(1, -1)
    : values;
  return {
    value: Number((sample.reduce((sum, value) => sum + value, 0) / sample.length).toFixed(3)),
    sampleSize: values.length
  };
}

export interface GapSample {
  lap: number;
  gapSec: number;
  clean: boolean;
}

export function calculateClosingRate(samples: GapSample[]): { value: number | null; sampleSize: number } {
  const clean = samples.filter((sample) => sample.clean).slice(-5);
  if (clean.length < 3) return { value: null, sampleSize: clean.length };
  const slopes: number[] = [];
  for (let leftIndex = 0; leftIndex < clean.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < clean.length; rightIndex += 1) {
      const left = clean[leftIndex];
      const right = clean[rightIndex];
      if (!left || !right || right.lap === left.lap) continue;
      slopes.push((left.gapSec - right.gapSec) / (right.lap - left.lap));
    }
  }
  const rate = Math.max(-heuristicConfig.closingVisualLimitSecPerLap, Math.min(heuristicConfig.closingVisualLimitSecPerLap, median(slopes)));
  return { value: Number(rate.toFixed(3)), sampleSize: clean.length };
}

export function projectCatch(
  gapSec: number,
  closingRateSecPerLap: number,
  targetGapSec: number,
  remainingLaps: number,
  confidence: Confidence
): { value: number; minLaps: number; maxLaps: number } | null {
  if (closingRateSecPerLap < heuristicConfig.closingMinimumSecPerLap || gapSec <= targetGapSec) return null;
  const catchLaps = (gapSec - targetGapSec) / closingRateSecPerLap;
  if (catchLaps > 10 || catchLaps > remainingLaps) return null;
  const rounded = Math.max(1, Math.round(catchLaps));
  const range = confidence === 'high' ? 1 : confidence === 'medium' ? 2 : 3;
  return { value: rounded, minLaps: Math.max(1, rounded - range), maxLaps: rounded + range };
}

export function classifyDrs(
  gapSec: number | null,
  closingRateSecPerLap: number | null,
  drsEnabled: boolean | null
): { state: Battle['drsState']; estimated: boolean } {
  if (gapSec === null || drsEnabled === false) return { state: 'unknown', estimated: drsEnabled === null };
  const estimated = drsEnabled === null;
  if (gapSec <= heuristicConfig.drsThresholdSec) return { state: 'inside', estimated };
  if (gapSec <= heuristicConfig.drsApproachingThresholdSec && (closingRateSecPerLap ?? 0) >= heuristicConfig.closingMinimumSecPerLap) {
    return { state: 'approaching', estimated };
  }
  return { state: 'outside', estimated };
}

export function calculateTyreAge(currentLap: number, stint: Pick<NonNullable<DriverState['currentStint']>, 'startLap' | 'tyreAgeAtStart'>): number {
  return currentLap - stint.startLap + 1 + (stint.tyreAgeAtStart ?? 0);
}

export function calculateConfidence(input: {
  samples: number;
  ageSeconds: number;
  madSec: number;
  disrupted: boolean;
}): Confidence {
  if (input.ageSeconds > heuristicConfig.staleUnavailableSeconds) return 'unavailable';
  if (!input.disrupted && input.samples >= 5 && input.ageSeconds < 8 && input.madSec <= 0.2) return 'high';
  if (!input.disrupted && input.samples >= 3 && input.ageSeconds < 15 && input.madSec <= 0.4) return 'medium';
  return 'low';
}

function proximityScore(gapSec: number): number {
  if (gapSec <= 0.5) return 1;
  return Math.max(0, (3 - gapSec) / 2.5);
}

function battleConfidence(ahead: DriverState, behind: DriverState, sampleSize: number): Confidence {
  if (ahead.pace5Sec !== null && behind.pace5Sec !== null && sampleSize >= 5) return 'high';
  if (ahead.pace3Sec !== null && behind.pace3Sec !== null) return 'medium';
  return 'low';
}

export function detectBattles(
  drivers: DriverState[],
  favoriteDriverId: string | null,
  trackStatus: TrackStatusCode,
  sampleSize: number
): Battle[] {
  if (['SC', 'VSC', 'RED'].includes(trackStatus)) return [];
  const running = drivers
    .filter((driver) => driver.status === 'running' && driver.position !== null)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const battles: Battle[] = [];
  for (let index = 1; index < running.length; index += 1) {
    const ahead = running[index - 1];
    const behind = running[index];
    if (!ahead || !behind || behind.intervalAheadSec === null || behind.intervalAheadSec <= 0 || behind.intervalAheadSec > 3) continue;
    const closingRate = ahead.pace5Sec !== null && behind.pace5Sec !== null
      ? Number(Math.max(-1.5, Math.min(1.5, ahead.pace5Sec - behind.pace5Sec)).toFixed(3))
      : null;
    const confidence = battleConfidence(ahead, behind, sampleSize);
    const drs = classifyDrs(behind.intervalAheadSec, closingRate, null);
    const catchProjection = closingRate === null
      ? null
      : projectCatch(behind.intervalAheadSec, closingRate, drs.state === 'approaching' ? 1 : 0.3, 20, confidence);
    const score =
      45 * proximityScore(behind.intervalAheadSec) +
      25 * Math.min(1, Math.max(0, (closingRate ?? 0) / 0.3)) +
      15 * (drs.state === 'inside' ? 1 : drs.state === 'approaching' ? 0.6 : 0) +
      10 * (favoriteDriverId && [ahead.driverId, behind.driverId].includes(favoriteDriverId) ? 1 : 0) +
      5 * ((behind.position ?? 20) <= 10 ? 1 : 0);
    battles.push({
      id: `battle:${ahead.driverId}:${behind.driverId}`,
      aheadDriverId: ahead.driverId,
      behindDriverId: behind.driverId,
      gapSec: behind.intervalAheadSec,
      closingRateSecPerLap: closingRate,
      projectedCatchLaps: catchProjection?.value ?? null,
      projectedCatchRange: catchProjection ? [catchProjection.minLaps, catchProjection.maxLaps] : null,
      drsState: drs.state,
      relevanceScore: Number(Math.min(100, score).toFixed(1)),
      confidence,
      evidence: [
        `Gap ${behind.intervalAheadSec.toFixed(1)} s`,
        closingRate === null ? 'Closing unavailable' : `Closing ${closingRate.toFixed(2)} s/lap`,
        `Sample ${sampleSize} clean laps`
      ],
      sampleSize
    });
  }
  return battles.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
}

export function calculatePitProjection(
  driver: DriverState,
  drivers: DriverState[],
  pitLossSec: number,
  confidence: Confidence,
  trackStatus: TrackStatusCode
): PitProjection {
  if (['SC', 'VSC', 'RED'].includes(trackStatus)) {
    return {
      driverId: driver.driverId,
      estimatedPitLossSec: pitLossSec,
      projectedRejoinPosition: null,
      projectedAheadDriverId: null,
      projectedBehindDriverId: null,
      confidence: 'unavailable',
      zoneLabel: null,
      disabledReason: `Disabled under ${trackStatus}`
    };
  }
  const projectedGap = (driver.gapToLeaderSec ?? 0) + pitLossSec;
  const ordered = [...drivers]
    .filter((candidate) => candidate.gapToLeaderSec !== null)
    .sort((a, b) => (a.gapToLeaderSec ?? 0) - (b.gapToLeaderSec ?? 0));
  const rawPosition = ordered.filter((candidate) => (candidate.gapToLeaderSec ?? 0) < projectedGap).length + 1;
  const ahead = ordered[rawPosition - 2] ?? null;
  const behind = ordered[rawPosition - 1] ?? null;
  return {
    driverId: driver.driverId,
    estimatedPitLossSec: pitLossSec,
    projectedRejoinPosition: confidence === 'low' || confidence === 'unavailable' ? null : rawPosition,
    projectedAheadDriverId: ahead?.driverId ?? null,
    projectedBehindDriverId: behind?.driverId ?? null,
    confidence,
    zoneLabel: confidence === 'low' ? 'Estimated rejoin zone' : null
  };
}

export function detectStrategySignals(
  drivers: DriverState[],
  projections: PitProjection[],
  trackStatus: TrackStatusCode,
  ageSeconds: number
): StrategySignal[] {
  if (['SC', 'VSC', 'RED'].includes(trackStatus) || ageSeconds > 15) return [];
  const ordered = [...drivers]
    .filter((driver) => driver.status === 'running' && driver.position !== null)
    .sort((left, right) => (left.position ?? 99) - (right.position ?? 99));
  const projectionsByDriver = new Map(projections.map((projection) => [projection.driverId, projection]));
  const signals: StrategySignal[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const ahead = ordered[index - 1];
    const chaser = ordered[index];
    if (!ahead || !chaser || chaser.intervalAheadSec === null || chaser.intervalAheadSec > 3) continue;
    const projection = projectionsByDriver.get(chaser.driverId);
    if (!projection || !['high', 'medium'].includes(projection.confidence) || projection.disabledReason) continue;
    const paceAdvantage = ahead.pace5Sec !== null && chaser.pace5Sec !== null ? ahead.pace5Sec - chaser.pace5Sec : null;
    const chaserAge = chaser.currentStint?.currentAgeLaps;
    const aheadAge = ahead.currentStint?.currentAgeLaps;
    const tyreCondition = chaserAge !== null && chaserAge !== undefined && aheadAge !== null && aheadAge !== undefined && chaserAge <= aheadAge;
    if (!tyreCondition && (paceAdvantage === null || paceAdvantage < 0.15)) continue;
    const confidence: Confidence = projection.confidence === 'high' && ageSeconds < 8 ? 'high' : 'medium';
    signals.push({
      id: `strategy:undercut:${chaser.driverId}:${ahead.driverId}`,
      type: 'undercut_candidate',
      driverId: chaser.driverId,
      rivalDriverId: ahead.driverId,
      headline: `Estimated undercut chance for ${chaser.code} on ${ahead.code}`,
      confidence,
      evidence: [
        `Gap ${chaser.intervalAheadSec.toFixed(1)} s`,
        paceAdvantage === null ? 'Pace comparison unavailable' : `Pace advantage ${paceAdvantage.toFixed(2)} s/lap`,
        `Tyre age ${chaserAge ?? '?'} vs ${aheadAge ?? '?'} laps`,
        `Pit loss estimate ${projection.estimatedPitLossSec.toFixed(1)} s`
      ]
    });
  }
  return signals.slice(0, 3);
}
