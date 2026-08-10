export interface HeuristicConfig {
  cleanLapOutlierRace: number;
  cleanLapOutlierPractice: number;
  battleMaximumGapSec: number;
  closingMinimumSecPerLap: number;
  closingVisualLimitSecPerLap: number;
  drsThresholdSec: number;
  drsApproachingThresholdSec: number;
  globalPitLossSec: number;
  staleUnavailableSeconds: number;
}

export const heuristicConfig: Readonly<HeuristicConfig> = Object.freeze({
  cleanLapOutlierRace: 1.07,
  cleanLapOutlierPractice: 1.1,
  battleMaximumGapSec: 3,
  closingMinimumSecPerLap: 0.05,
  closingVisualLimitSecPerLap: 1.5,
  drsThresholdSec: 1,
  drsApproachingThresholdSec: 1.8,
  globalPitLossSec: 22,
  staleUnavailableSeconds: 30
});
