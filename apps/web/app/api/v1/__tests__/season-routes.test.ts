import { describe, expect, it } from 'vitest';
import { GET as getSeason } from '../season/2026/route';
import { GET as getCircuit } from '../season/2026/circuits/[id]/route';
import { GET as getDriver } from '../season/2026/drivers/[id]/route';
import { GET as getTeam } from '../season/2026/teams/[id]/route';

describe('2026 catalog API', () => {
  it('returns the complete versioned catalog', async () => {
    const response = await getSeason(new Request('http://localhost/api/v1/season/2026'));
    const catalog = await response.json();
    expect(response.status).toBe(200);
    expect(catalog).toMatchObject({ season: 2026 });
    expect(catalog.drivers).toHaveLength(22);
    expect(catalog.teams).toHaveLength(11);
    expect(catalog.circuits).toHaveLength(25);
  });

  it('returns related circuit, driver, and team data', async () => {
    const circuitResponse = await getCircuit(
      new Request('http://localhost/api/v1/season/2026/circuits/track%3Aopenf1%3A4'),
      { params: Promise.resolve({ id: 'track:openf1:4' }) }
    );
    const driverResponse = await getDriver(
      new Request('http://localhost/api/v1/season/2026/drivers/driver%3A1%3A2026'),
      { params: Promise.resolve({ id: 'driver:1:2026' }) }
    );
    const driver = await driverResponse.json();
    const teamResponse = await getTeam(
      new Request(`http://localhost/api/v1/season/2026/teams/${encodeURIComponent(driver.team.id)}`),
      { params: Promise.resolve({ id: driver.team.id }) }
    );

    expect(await circuitResponse.json()).toMatchObject({ circuit: { name: 'Hungaroring', layoutStatus: 'verified' } });
    expect(driver).toMatchObject({ driver: { fullName: 'Lando Norris', number: 1 } });
    expect(await teamResponse.json()).toMatchObject({ drivers: [{ teamId: driver.team.id }, { teamId: driver.team.id }] });
  });

  it('uses a stable public 404 shape', async () => {
    const response = await getCircuit(
      new Request('http://localhost/api/v1/season/2026/circuits/missing'),
      { params: Promise.resolve({ id: 'missing' }) }
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'CIRCUIT_NOT_FOUND', retryable: false });
  });
});
