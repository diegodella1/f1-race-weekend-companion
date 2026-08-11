import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seasonCatalogSchema } from '../season';

const catalogPath = resolve(process.cwd(), 'fixtures/season-2026.json');

describe('2026 season catalog', () => {
  it('contains the complete verified grid and calendar', async () => {
    const catalog = seasonCatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));

    expect(catalog.season).toBe(2026);
    expect(catalog.drivers).toHaveLength(22);
    expect(catalog.teams).toHaveLength(11);
    expect(catalog.events).toHaveLength(25);
    expect(catalog.events.filter((event) => event.status === 'cancelled')).toHaveLength(2);
    expect(catalog.events.filter((event) => event.status !== 'cancelled')).toHaveLength(23);
    expect(new Set(catalog.drivers.map((driver) => driver.number)).size).toBe(22);
    expect(new Set(catalog.circuits.map((circuit) => circuit.circuitKey)).size).toBe(25);
    expect(Object.fromEntries(catalog.teams.map((team) => [team.name, team.driverIds.map((id) => catalog.drivers.find((driver) => driver.id === id)?.fullName).sort()]))).toEqual({
      Alpine: ['Franco Colapinto', 'Pierre Gasly'],
      'Aston Martin': ['Fernando Alonso', 'Lance Stroll'],
      Audi: ['Gabriel Bortoleto', 'Nico Hulkenberg'],
      Cadillac: ['Sergio Perez', 'Valtteri Bottas'],
      Ferrari: ['Charles Leclerc', 'Lewis Hamilton'],
      'Haas F1 Team': ['Esteban Ocon', 'Oliver Bearman'],
      McLaren: ['Lando Norris', 'Oscar Piastri'],
      Mercedes: ['George Russell', 'Kimi Antonelli'],
      'Racing Bulls': ['Arvid Lindblad', 'Liam Lawson'],
      'Red Bull Racing': ['Isack Hadjar', 'Max Verstappen'],
      Williams: ['Alexander Albon', 'Carlos Sainz']
    });
    expect(catalog.events.filter((event) => event.status === 'cancelled').map((event) => event.name)).toEqual(['Bahrain Grand Prix', 'Saudi Arabian Grand Prix']);
    expect(catalog.events.find((event) => event.circuitId === 'track:openf1:12')).toMatchObject({ status: 'scheduled', name: 'Bahrain Grand Prix' });
  });

  it('keeps every relation and circuit image fail-closed', async () => {
    const catalog = seasonCatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
    const driverIds = new Set(catalog.drivers.map((driver) => driver.id));
    const teamIds = new Set(catalog.teams.map((team) => team.id));
    const circuitIds = new Set(catalog.circuits.map((circuit) => circuit.id));

    expect(catalog.drivers.every((driver) => teamIds.has(driver.teamId))).toBe(true);
    expect(catalog.teams.every((team) => team.driverIds.length === 2 && team.driverIds.every((id) => driverIds.has(id)))).toBe(true);
    expect(catalog.events.every((event) => circuitIds.has(event.circuitId))).toBe(true);
    const verified = catalog.circuits.filter((circuit) => circuit.layoutStatus === 'verified');
    const unavailable = catalog.circuits.filter((circuit) => circuit.layoutStatus === 'unavailable');
    expect(verified).toHaveLength(23);
    expect(new Set(verified.map((circuit) => circuit.layoutImageUrl)).size).toBe(23);
    expect(verified.every((circuit) => circuit.layoutImageUrl?.startsWith('https://media.formula1.com/') && circuit.layoutSourceUrl !== null)).toBe(true);
    expect(unavailable.map((circuit) => circuit.circuitKey).sort((left, right) => left - right)).toEqual([12, 153]);
    expect(unavailable.every((circuit) => circuit.layoutImageUrl === null && circuit.layoutSourceUrl === null)).toBe(true);
  });
});
