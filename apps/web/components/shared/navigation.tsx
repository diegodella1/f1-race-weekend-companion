'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePreferences } from '@/lib/client/preferences';
import { ApexIcon, type ApexIconName } from './apex-icon';

export interface PrimaryNavigationItem {
  label: 'Live' | 'Track' | 'Strategy' | 'Favorite';
  href: string;
  active: boolean;
  icon: ApexIconName;
}

export function getPrimaryNavigation(pathname: string, favoriteDriverId: string | null): PrimaryNavigationItem[] {
  const favoriteHref = favoriteDriverId ? `/drivers/${encodeURIComponent(favoriteDriverId)}` : '/settings';
  return [
    { label: 'Live', href: '/weekend', active: pathname === '/' || pathname.startsWith('/weekend'), icon: 'dashboard' },
    { label: 'Track', href: '/track', active: pathname.startsWith('/track'), icon: 'track' },
    { label: 'Strategy', href: '/strategy', active: pathname.startsWith('/strategy'), icon: 'strategy' },
    { label: 'Favorite', href: favoriteHref, active: pathname === favoriteHref || (!favoriteDriverId && pathname.startsWith('/settings')), icon: 'favorite' }
  ];
}

export function PrimaryNavigation() {
  const pathname = usePathname();
  const favoriteDriverId = usePreferences((state) => state.favoriteDriverId);
  const items = getPrimaryNavigation(pathname, favoriteDriverId);
  return (
    <nav className="apex-nav" aria-label="Primary navigation">
      {items.map((item) => (
        <Link key={item.label} href={item.href} aria-current={item.active ? 'page' : undefined}>
          <ApexIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
