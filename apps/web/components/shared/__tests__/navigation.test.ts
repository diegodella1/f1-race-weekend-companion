import { describe, expect, it } from 'vitest';
import { getPrimaryNavigation } from '../navigation';

describe('primary navigation', () => {
  it('exposes the agreed routes and resolves Favorite locally', () => {
    const items = getPrimaryNavigation('/strategy', 'driver:81:2024');
    expect(items.map(({ label, href }) => [label, href])).toEqual([
      ['Live', '/weekend'],
      ['Track', '/track'],
      ['Strategy', '/strategy'],
      ['Favorite', '/drivers/driver%3A81%3A2024']
    ]);
    expect(items.find((item) => item.label === 'Strategy')?.active).toBe(true);
  });

  it('sends Favorite to settings until a driver is chosen', () => {
    expect(getPrimaryNavigation('/settings', null).at(-1)).toMatchObject({ href: '/settings', active: true });
  });
});
