import Link from 'next/link';
import { SettingsForm } from '@/components/settings/settings-form';
import { getServerRuntime } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const runtime = await getServerRuntime();
  const sessionId = runtime.meeting.sessions.find((session) => session.kind === 'race')?.id ?? '';
  const snapshot = await runtime.engine.getSnapshot(sessionId, { delaySeconds: 0, favoriteDriverId: null });
  return <main className="page-frame settings-page"><Link className="back-link" href="/weekend">← Live timing</Link><p className="eyebrow">LOCAL PREFERENCES</p><h1>Settings</h1><p>Stored only on this device. No account or personal profile.</p><SettingsForm drivers={snapshot.drivers}/></main>;
}
