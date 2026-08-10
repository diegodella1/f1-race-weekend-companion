'use client';

import type { Meeting, SessionSnapshot } from '@f1/domain';
import { usePreferences } from '@/lib/client/preferences';
import { useLiveSession } from '@/lib/client/use-live-session';
import { BattleList } from './battle-list';
import { BottomNav } from '@/components/shared/bottom-nav';
import { DataStateBanner } from '@/components/shared/data-state-banner';
import { ExplainSheet } from './explain-sheet';
import { FavoriteStrip } from './favorite-strip';
import { Leaderboard } from './leaderboard';
import { RaceControlFeed } from './race-control-feed';
import { RaceHeader } from './race-header';
import { ReplayControls } from './replay-controls';
import { StrategyPanel } from './strategy-panel';
import { PriorityBanner } from './priority-banner';
import { PostRaceView } from '@/components/modes/post-race-view';

export function RaceMode({ meeting, initialSnapshot }: { meeting: Meeting; initialSnapshot: SessionSnapshot }) {
  const favoriteDriverId = usePreferences((state) => state.favoriteDriverId);
  const { data: snapshot, streamHealth, streamConnected, error } = useLiveSession(initialSnapshot.id, initialSnapshot);
  if (error && !snapshot) return <FatalSessionError message={error.message} />;
  if (snapshot.phase === 'finished_provisional' || snapshot.phase === 'finished_final') {
    return <PostRaceView meeting={meeting} snapshot={snapshot} />;
  }
  const favorite = snapshot.drivers.find((driver) => driver.driverId === favoriteDriverId) ?? null;
  const favoriteBattle = snapshot.battles.find((battle) => favoriteDriverId && [battle.aheadDriverId, battle.behindDriverId].includes(favoriteDriverId)) ?? null;
  const priorityMessage = [...snapshot.raceControl].reverse().find((event) => event.priority === 'high');
  return (
    <div className="app-shell">
      <div className="telemetry-rail" aria-hidden="true"><span>F1C / LIVE</span><i /></div>
      <main className="race-layout">
        <RaceHeader meeting={meeting} snapshot={snapshot} />
        <DataStateBanner snapshot={snapshot} health={streamHealth} streamConnected={streamConnected} />
        <PriorityBanner event={priorityMessage} />
        {snapshot.meta.provider === 'replay' ? <ReplayControls sessionId={snapshot.id} /> : null}
        <FavoriteStrip driver={favorite} battle={favoriteBattle} />
        <ExplainSheet insights={snapshot.insights} />
        <div className="race-grid">
          <section className="leaderboard-panel" aria-labelledby="leaderboard-title">
            <div className="panel-heading"><div><p className="eyebrow">LIVE ORDER</p><h2 id="leaderboard-title">Timing tower</h2></div><span>{snapshot.drivers.length}</span></div>
            <Leaderboard drivers={snapshot.drivers} favoriteDriverId={favoriteDriverId} />
          </section>
          <aside className="context-column">
            <BattleList battles={snapshot.battles} drivers={snapshot.drivers} sessionId={snapshot.id} />
            <StrategyPanel signals={snapshot.strategySignals} projections={snapshot.pitProjections} drivers={snapshot.drivers} />
            <RaceControlFeed events={snapshot.raceControl} />
          </aside>
        </div>
      </main>
      <BottomNav favoriteDriverId={favoriteDriverId} />
    </div>
  );
}

function FatalSessionError({ message }: { message: string }) {
  return <main className="center-state"><p className="eyebrow">CONNECTION FAILED</p><h1>Timing is unavailable</h1><p>{message}</p><button type="button" onClick={() => location.reload()}>Retry</button></main>;
}
