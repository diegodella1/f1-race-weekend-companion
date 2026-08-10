import { z } from 'zod';

export const confidenceSchema = z.enum(['high', 'medium', 'low', 'unavailable']);
export const sessionKindSchema = z.enum(['practice', 'qualifying', 'sprint', 'race']);
export const sessionPhaseSchema = z.enum([
  'scheduled',
  'pre_live',
  'live',
  'suspended',
  'finishing',
  'finished_provisional',
  'finished_final',
  'unavailable'
]);
export const tyreCompoundSchema = z.enum(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET', 'TEST_UNKNOWN']);
export const trackStatusCodeSchema = z.enum(['GREEN', 'YELLOW', 'SC', 'VSC', 'RED', 'CHEQUERED', 'UNKNOWN']);

export const dataMetaSchema = z.object({
  provider: z.string().min(1),
  sourceUpdatedAt: z.iso.datetime().nullable(),
  ingestedAt: z.iso.datetime(),
  stale: z.boolean(),
  ageSeconds: z.number().nonnegative()
});

export const trackStatusSchema = z.object({
  code: trackStatusCodeSchema,
  label: z.string().min(1)
});

export const lapSchema = z.object({
  lapNumber: z.number().int().positive(),
  timeSec: z.number().positive().nullable(),
  sectorsSec: z.array(z.number().positive().nullable()).max(3),
  startedAt: z.iso.datetime().nullable(),
  compound: tyreCompoundSchema.nullable(),
  isPitIn: z.boolean(),
  isPitOut: z.boolean(),
  trackStatus: trackStatusCodeSchema,
  clean: z.boolean(),
  exclusionReasons: z.array(z.string())
});

export const stintSchema = z.object({
  index: z.number().int().nonnegative(),
  compound: tyreCompoundSchema.nullable(),
  startLap: z.number().int().positive(),
  endLap: z.number().int().positive().nullable(),
  tyreAgeAtStart: z.number().int().nonnegative().nullable(),
  currentAgeLaps: z.number().int().positive().nullable()
});

export const driverStateSchema = z.object({
  driverId: z.string().min(1),
  number: z.number().int().nonnegative(),
  code: z.string().min(2).max(4),
  fullName: z.string().min(1),
  teamName: z.string().min(1),
  teamColor: z.string().nullable(),
  position: z.number().int().positive().nullable(),
  status: z.enum(['running', 'pit', 'retired', 'dns', 'finished', 'unknown']),
  gapToLeaderSec: z.number().nonnegative().nullable(),
  intervalAheadSec: z.number().nonnegative().nullable(),
  lastLapSec: z.number().positive().nullable(),
  bestLapSec: z.number().positive().nullable(),
  pace3Sec: z.number().positive().nullable(),
  pace5Sec: z.number().positive().nullable(),
  currentStint: stintSchema.nullable(),
  stints: z.array(stintSchema),
  laps: z.array(lapSchema)
});

export const raceControlEventSchema = z.object({
  id: z.string().min(1),
  occurredAt: z.iso.datetime(),
  category: z.enum(['flag', 'safety_car', 'incident', 'investigation', 'penalty', 'message']),
  priority: z.enum(['high', 'normal']),
  sourceText: z.string(),
  label: z.string().nullable(),
  driverIds: z.array(z.string())
});

export const battleSchema = z.object({
  id: z.string().min(1),
  aheadDriverId: z.string(),
  behindDriverId: z.string(),
  gapSec: z.number().positive(),
  closingRateSecPerLap: z.number().nullable(),
  projectedCatchLaps: z.number().positive().nullable(),
  projectedCatchRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).nullable(),
  drsState: z.enum(['inside', 'approaching', 'outside', 'unknown']),
  relevanceScore: z.number().min(0).max(100),
  confidence: confidenceSchema,
  evidence: z.array(z.string()),
  sampleSize: z.number().int().nonnegative()
});

export const pitProjectionSchema = z.object({
  driverId: z.string(),
  estimatedPitLossSec: z.number().positive(),
  projectedRejoinPosition: z.number().int().positive().nullable(),
  projectedAheadDriverId: z.string().nullable(),
  projectedBehindDriverId: z.string().nullable(),
  confidence: confidenceSchema,
  zoneLabel: z.string().nullable(),
  disabledReason: z.string().optional()
});

export const strategySignalSchema = z.object({
  id: z.string(),
  type: z.enum(['undercut_candidate', 'undercut_threat', 'overcut_candidate']),
  driverId: z.string(),
  rivalDriverId: z.string(),
  headline: z.string(),
  confidence: confidenceSchema,
  evidence: z.array(z.string())
});

export const insightSchema = z.object({
  id: z.string(),
  type: z.enum(['race_status', 'favorite', 'battle', 'strategy', 'pace', 'tyres']),
  priority: z.number(),
  headline: z.string(),
  evidence: z.array(z.string()),
  confidence: confidenceSchema,
  updatedAt: z.iso.datetime(),
  entityRefs: z.array(z.string())
});

export const sessionSnapshotSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  kind: sessionKindSchema,
  phase: sessionPhaseSchema,
  segment: z.enum(['Q1', 'Q2', 'Q3']).nullable(),
  startedAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  clockSeconds: z.number().nonnegative().nullable(),
  lap: z.number().int().nonnegative().nullable(),
  totalLaps: z.number().int().positive().nullable(),
  trackStatus: trackStatusSchema,
  drivers: z.array(driverStateSchema),
  raceControl: z.array(raceControlEventSchema),
  battles: z.array(battleSchema),
  pitProjections: z.array(pitProjectionSchema),
  strategySignals: z.array(strategySignalSchema),
  insights: z.array(insightSchema),
  revision: z.number().int().nonnegative(),
  requestedDelaySeconds: z.number().int().nonnegative(),
  effectiveDelaySeconds: z.number().nonnegative(),
  meta: dataMetaSchema
});

export const sessionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: sessionKindSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  phase: sessionPhaseSchema
});

export const meetingSchema = z.object({
  id: z.string(),
  name: z.string(),
  countryCode: z.string().min(2).max(3),
  circuitId: z.string(),
  circuitName: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  sessions: z.array(sessionSummarySchema),
  nextMeeting: z.object({ id: z.string(), name: z.string(), startsAt: z.iso.datetime() }).optional()
});

export const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  countryCode: z.string().min(2).max(3),
  lengthKm: z.number().positive().nullable(),
  laps: z.number().int().positive().nullable(),
  pitLossSec: z.number().positive().nullable(),
  drsZones: z.array(z.string()),
  sectors: z.array(z.string()),
  layoutPath: z.string().nullable()
});

export const dataHealthSchema = z.object({
  provider: z.string(),
  state: z.enum(['fresh', 'stale', 'offline', 'rate_limited', 'unavailable']),
  lastSuccessAt: z.iso.datetime().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  rateLimited: z.boolean(),
  message: z.string().nullable()
});

export const providerCapabilitiesSchema = z.object({
  gaps: z.boolean(),
  sectors: z.boolean(),
  stints: z.boolean(),
  raceControl: z.boolean(),
  weather: z.boolean(),
  physicalOrder: z.boolean(),
  drsStatus: z.boolean(),
  finalClassification: z.boolean(),
  livePush: z.boolean()
});

export const preferencesSchema = z.object({
  favoriteDriverId: z.string().nullable(),
  syncDelaySeconds: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]),
  timezone: z.enum(['local', 'circuit']),
  units: z.literal('metric'),
  reducedData: z.boolean(),
  dismissedOnboarding: z.boolean()
});

export type Confidence = z.infer<typeof confidenceSchema>;
export type SessionKind = z.infer<typeof sessionKindSchema>;
export type SessionPhase = z.infer<typeof sessionPhaseSchema>;
export type TyreCompound = z.infer<typeof tyreCompoundSchema>;
export type TrackStatusCode = z.infer<typeof trackStatusCodeSchema>;
export type DataMeta = z.infer<typeof dataMetaSchema>;
export type TrackStatus = z.infer<typeof trackStatusSchema>;
export type Lap = z.infer<typeof lapSchema>;
export type Stint = z.infer<typeof stintSchema>;
export type DriverState = z.infer<typeof driverStateSchema>;
export type RaceControlEvent = z.infer<typeof raceControlEventSchema>;
export type Battle = z.infer<typeof battleSchema>;
export type PitProjection = z.infer<typeof pitProjectionSchema>;
export type StrategySignal = z.infer<typeof strategySignalSchema>;
export type Insight = z.infer<typeof insightSchema>;
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type Meeting = z.infer<typeof meetingSchema>;
export type Track = z.infer<typeof trackSchema>;
export type DataHealth = z.infer<typeof dataHealthSchema>;
export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;

export interface DateRange {
  from: string;
  to: string;
}

export interface DerivedMetric<T> {
  value: T | null;
  confidence: Confidence;
  sampleSize: number;
  evidence: string[];
}

export interface SessionPatch {
  revision: number;
  baseRevision: number;
  session?: Partial<Pick<SessionSnapshot, 'phase' | 'segment' | 'clockSeconds' | 'lap' | 'trackStatus'>>;
  drivers?: DriverState[];
  raceControlAppend?: RaceControlEvent[];
  battles?: Battle[];
  pitProjections?: PitProjection[];
  strategySignals?: StrategySignal[];
  insights?: Insight[];
  meta?: DataMeta;
}

export type StreamEvent =
  | { type: 'snapshot'; revision: number; data: SessionSnapshot }
  | { type: 'patch'; revision: number; data: SessionPatch }
  | { type: 'health'; revision: number; data: DataHealth }
  | { type: 'heartbeat'; revision: number; data: { at: string } };
