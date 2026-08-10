export default function WeekendLoading() {
  return <main className="page-frame" aria-label="Connecting to session data"><div className="skeleton skeleton--header"/><div className="skeleton skeleton--strip"/>{Array.from({ length: 10 }, (_, index) => <div className="skeleton skeleton--row" key={index}/>)}</main>;
}
