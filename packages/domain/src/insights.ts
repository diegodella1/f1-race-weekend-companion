import type { Insight, SessionSnapshot } from './models';

const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

export function validateInsightEvidence(insight: Insight): boolean {
  const evidenceNumbers = new Set(insight.evidence.join(' ').match(NUMBER_PATTERN) ?? []);
  const headlineNumbers = insight.headline.match(NUMBER_PATTERN) ?? [];
  return headlineNumbers.every((number) => evidenceNumbers.has(number));
}

function raceStatusInsight(previous: SessionSnapshot | null, current: SessionSnapshot): Insight | null {
  if (!previous) return null;
  if (previous.trackStatus.code === current.trackStatus.code) {
    return previous.insights.find((insight) => insight.type === 'race_status' && insight.headline === current.trackStatus.label) ?? null;
  }
  return {
    id: `race_status:${current.revision}`,
    type: 'race_status',
    priority: 100,
    headline: current.trackStatus.label,
    evidence: [`Race control status ${current.trackStatus.code}`],
    confidence: 'high',
    updatedAt: current.meta.sourceUpdatedAt ?? current.meta.ingestedAt,
    entityRefs: [current.id]
  };
}

export function buildInsights(
  previous: SessionSnapshot | null,
  current: SessionSnapshot,
  favoriteDriverId: string | null
): Insight[] {
  const candidates: Insight[] = [];
  const status = raceStatusInsight(previous, current);
  if (status) candidates.push(status);

  for (const battle of current.battles) {
    const ahead = current.drivers.find((driver) => driver.driverId === battle.aheadDriverId);
    const behind = current.drivers.find((driver) => driver.driverId === battle.behindDriverId);
    if (!ahead || !behind || battle.closingRateSecPerLap === null) continue;
    candidates.push({
      id: `insight:${battle.id}:${current.revision}`,
      type: favoriteDriverId && [ahead.driverId, behind.driverId].includes(favoriteDriverId) ? 'favorite' : 'battle',
      priority: 50 + battle.relevanceScore,
      headline: `${behind.code} closes on ${ahead.code} · ${battle.gapSec.toFixed(1)} s`,
      evidence: [...battle.evidence],
      confidence: battle.confidence,
      updatedAt: current.meta.sourceUpdatedAt ?? current.meta.ingestedAt,
      entityRefs: [ahead.driverId, behind.driverId]
    });
  }

  for (const signal of current.strategySignals) {
    candidates.push({
      id: `insight:${signal.id}:${current.revision}`,
      type: 'strategy',
      priority: 62,
      headline: signal.headline,
      evidence: signal.evidence,
      confidence: signal.confidence,
      updatedAt: current.meta.sourceUpdatedAt ?? current.meta.ingestedAt,
      entityRefs: [signal.driverId, signal.rivalDriverId]
    });
  }

  return candidates
    .filter(validateInsightEvidence)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}
