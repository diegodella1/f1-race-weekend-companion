import type {
  DateRange,
  Meeting,
  ProviderCapabilities,
  SessionSnapshot,
  SessionSummary
} from '@f1/domain';

export interface ProviderUpdate {
  cursor: string;
  snapshot: SessionSnapshot;
}

export interface ProviderUpdateBatch {
  updates: ProviderUpdate[];
  nextCursor: string | null;
}

export interface TimingProvider {
  readonly name: string;
  getMeetings(range: DateRange): Promise<Meeting[]>;
  getSessions(meetingId: string): Promise<SessionSummary[]>;
  getSessionSnapshot(sessionId: string): Promise<SessionSnapshot>;
  getUpdates(sessionId: string, since?: string): Promise<ProviderUpdateBatch>;
  getHistoricalSession(sessionId: string): Promise<SessionSnapshot>;
  capabilities(): ProviderCapabilities;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
