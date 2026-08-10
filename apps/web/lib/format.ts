import type { Confidence, TrackStatusCode, TyreCompound } from '@f1/domain';

export function formatLapTime(seconds: number | null): string {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${minutes}:${remainder}`;
}

export function formatGap(seconds: number | null, leader = false): string {
  if (leader) return 'LEADER';
  return seconds === null ? '—' : `+${seconds.toFixed(1)}`;
}

export function formatCompound(compound: TyreCompound | null): string {
  if (!compound) return '?';
  return compound === 'INTERMEDIATE' ? 'I' : compound === 'TEST_UNKNOWN' ? '?' : compound[0] ?? '?';
}

export function confidenceLabel(confidence: Confidence): string {
  return confidence.toUpperCase();
}

export function statusTone(code: TrackStatusCode): 'green' | 'yellow' | 'red' | 'muted' {
  if (code === 'GREEN') return 'green';
  if (['YELLOW', 'SC', 'VSC'].includes(code)) return 'yellow';
  if (code === 'RED') return 'red';
  return 'muted';
}
