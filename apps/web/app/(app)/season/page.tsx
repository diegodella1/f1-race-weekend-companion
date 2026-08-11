import Link from 'next/link';
import { ApexScreen } from '@/components/shared/apex-screen';
import { CircuitCatalog, DriverCatalog, TeamCatalog } from '@/components/season/season-cards';
import { getSeasonCatalog } from '@/lib/server/season-catalog';

export const dynamic = 'force-dynamic';

type CatalogView = 'circuits' | 'drivers' | 'teams';

export default async function SeasonPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const [catalog, parameters] = await Promise.all([getSeasonCatalog(), searchParams]);
  const view = catalogView(parameters.view);
  const query = parameters.q?.trim() ?? '';
  const circuits = catalog.circuits.filter((circuit) => matches(query, circuit.name, circuit.location, circuit.countryName));
  const drivers = catalog.drivers.filter((driver) => matches(query, driver.fullName, driver.code, driver.teamName));
  const teams = catalog.teams.filter((team) => matches(query, team.name));

  return (
    <ApexScreen>
      <main className="page-frame season-page">
        <header className="season-hero">
          <div><p className="eyebrow">COMPLETE · VERIFIED · CURRENT</p><h1>Season <span>2026</span></h1><p>Every driver, team and Grand Prix. Official circuit maps only.</p></div>
          <dl><div><dt>Drivers</dt><dd>22</dd></div><div><dt>Teams</dt><dd>11</dd></div><div><dt>GP records</dt><dd>25</dd></div></dl>
        </header>
        <nav className="season-tabs" aria-label="2026 catalog">
          {(['circuits', 'drivers', 'teams'] as const).map((item) => <Link key={item} href={`/season?view=${item}`} aria-current={view === item ? 'page' : undefined}>{item}</Link>)}
        </nav>
        <form className="season-search" action="/season" role="search">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="season-query">Search {view}</label>
          <div><input id="season-query" name="q" type="search" defaultValue={query} placeholder="Name, code, team or country" /><button type="submit">Search</button></div>
        </form>
        <div className="season-result-count"><b>{view === 'circuits' ? circuits.length : view === 'drivers' ? drivers.length : teams.length}</b><span>{view} shown</span></div>
        {view === 'circuits' ? <CircuitCatalog circuits={circuits} events={catalog.events} /> : null}
        {view === 'drivers' ? <DriverCatalog drivers={drivers} /> : null}
        {view === 'teams' ? <TeamCatalog teams={teams} drivers={catalog.drivers} /> : null}
        <footer className="season-sources"><b>Data provenance</b><p>Entry list and calendar verified against Formula 1 and FIA. Historical timing supplied by OpenF1. Changed circuit images stay hidden until approved.</p>{catalog.sources.map((source) => <a key={source.url} href={source.url} rel="noreferrer">{source.name}</a>)}</footer>
      </main>
    </ApexScreen>
  );
}

function catalogView(value: string | undefined): CatalogView {
  return value === 'drivers' || value === 'teams' ? value : 'circuits';
}

function matches(query: string, ...values: string[]): boolean {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase('en');
  return values.some((value) => value.toLocaleLowerCase('en').includes(normalized));
}
