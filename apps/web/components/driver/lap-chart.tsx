import type { DriverState } from '@f1/domain';

export function LapChart({ drivers }: { drivers: [DriverState, DriverState] }) {
  const allTimes = drivers.flatMap((driver) => driver.laps.filter((lap) => lap.clean && lap.timeSec !== null).map((lap) => lap.timeSec as number));
  if (allTimes.length === 0) return <p className="empty-copy">Lap chart data unavailable.</p>;
  const minimum = Math.min(...allTimes) - 0.2;
  const maximum = Math.max(...allTimes) + 0.2;
  const range = Math.max(0.1, maximum - minimum);
  const paths = drivers.map((driver) => driver.laps.filter((lap) => lap.clean && lap.timeSec !== null).map((lap, index, laps) => {
    const x = laps.length === 1 ? 20 : 20 + (index / (laps.length - 1)) * 560;
    const y = 20 + (((lap.timeSec as number) - minimum) / range) * 180;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' '));
  return (
    <figure className="lap-chart"><svg viewBox="0 0 600 230" role="img" aria-labelledby="lap-chart-title"><title id="lap-chart-title">Clean lap time comparison</title><path d={paths[0]} className="chart-line chart-line--a"/><path d={paths[1]} className="chart-line chart-line--b"/></svg><figcaption><span>{drivers[0].code}</span><span>{drivers[1].code}</span> · clean laps only</figcaption></figure>
  );
}
