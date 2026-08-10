import Link from 'next/link';

export function BottomNav({ favoriteDriverId }: { favoriteDriverId: string | null }) {
  return (
    <nav className="bottom-nav" aria-label="Session navigation">
      <Link href="/weekend" aria-current="page"><span aria-hidden="true">●</span> Live</Link>
      <Link href="/weekend#battles"><span aria-hidden="true">↔</span> Battles</Link>
      <Link href="/track"><span aria-hidden="true">⌁</span> Track</Link>
      <Link href={favoriteDriverId ? `/drivers/${encodeURIComponent(favoriteDriverId)}` : '/settings'}><span aria-hidden="true">★</span> Favorite</Link>
    </nav>
  );
}
