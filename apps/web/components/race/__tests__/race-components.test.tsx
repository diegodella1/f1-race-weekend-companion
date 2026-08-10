import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { Leaderboard } from '../leaderboard';
import { FavoriteStrip } from '../favorite-strip';
import { BattleList } from '../battle-list';
import { getMockDriver } from '../../../../../packages/domain/src/__tests__/factories';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={String(href)} {...props}>{children}</a>
}));

const leader = getMockDriver();
const challenger = getMockDriver({
  driverId: 'driver:81:2024', number: 81, code: 'PIA', fullName: 'Oscar Piastri',
  position: 2, gapToLeaderSec: 1.4, intervalAheadSec: 1.4, pace5Sec: 89.4
});
const battle = {
  id: 'battle:NOR:PIA', aheadDriverId: leader.driverId, behindDriverId: challenger.driverId,
  gapSec: 1.4, closingRateSecPerLap: 0.18, projectedCatchLaps: 3, projectedCatchRange: [2, 4] as [number, number],
  drsState: 'approaching' as const, relevanceScore: 82, confidence: 'medium' as const,
  evidence: ['Gap 1.4 s', 'Closing 0.18 s/lap', 'Sample 4 clean laps'], sampleSize: 4
};

describe('race components', () => {
  it('renders semantic timing rows and favorite state', async () => {
    const { container } = render(<Leaderboard drivers={[leader, challenger]} favoriteDriverId={challenger.driverId} />);
    expect(screen.getByRole('table', { name: /current race order/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PIA/i }).closest('tr')).toHaveClass('is-favorite');
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);
  });

  it('offers a favorite selection when none exists', () => {
    render(<FavoriteStrip driver={null} battle={null} />);
    expect(screen.getByRole('link', { name: /choose your favorite driver/i })).toHaveAttribute('href', '/settings');
  });

  it('shows evidence and comparison route for an automatic battle', () => {
    render(<BattleList battles={[battle]} drivers={[leader, challenger]} sessionId="session:replay:demo-race-2024" />);
    expect(screen.getByText('Gap 1.4 s · Closing 0.18 s/lap · Sample 4 clean laps')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /compare drivers/i })).toHaveAttribute('href', expect.stringContaining('/compare?'));
  });
});
