# Apex Velocity design mapping

`dsn/f1f1f1.zip` is the immutable visual reference for this release. It contains seven Stitch mockups plus `apex_velocity/DESIGN.md`. None of its HTML, screenshots, remote fonts, CDN scripts, or external images are loaded at runtime.

The implementation treats the archive as presentation guidance, while the PRD and normalized `SessionSnapshot` remain the authority for product scope and visible facts.

## Mockup mapping

| ZIP mockup | Product destination | Data used | Intentionally excluded or replaced |
|---|---|---|---|
| `race_dashboard_apex_edition` | `/weekend` race mode | classified drivers, intervals, compounds, tyre age, clean-lap pace, battles | speed, gear, throttle, brake, fabricated positions |
| `live_control_apex_edition` | `/weekend` header, Race Control, replay and Explain | track status, lap, replay clock, priority messages, deterministic insights | team radio, broadcast controls, unsupported live telemetry |
| `strategy_analysis_apex_edition` | `/strategy?a=&b=` | shared clean laps, stints, tyre age, strategy signals, pit projections, confidence | invented pit windows, weather assumptions, unlabeled certainty |
| `interactive_track_map_apex_edition` | `/track` and `/season/circuits/:id` | verified Formula 1 circuit image, supplied metrics, measured sector leaders | hand-drawn layouts, animated car positions, weather, missing telemetry |
| `performance_analysis_apex_edition` | `/compare?a=&b=` and driver detail | best/last/clean laps, sectors, gaps, stints | photos, speed traces, throttle/brake traces |
| `standings_apex_edition` | practice, qualifying and post-race session classification | current session order and supplied final/provisional state | season standings, championship points, inferred official results |
| `weekend_hub_apex_edition` | scheduled/pre-live `/weekend` state and `/season` catalog | meeting, circuit, session schedule, verified 2026 calendar and entry list | news, championship standings, unsupported forecasts |

## Implemented visual contract

- Chivo Variable for display headings, Hanken Grotesk Variable for body copy, and JetBrains Mono Variable for timing. Font files ship in the application bundle.
- Ultra-dark charcoal surfaces, reference salmón `#ffb4a7`, technical cyan `#00d2ff`, and separate critical/status colors. The archive metadata and prose disagree on the primary red; the implementation reserves stronger red for track and alert semantics.
- Four-pixel spacing rhythm, compact angular surfaces, local SVG icons, subtle CSS carbon texture, and restrained glow on active state only.
- One shared masthead and primary navigation: Live, Track, Strategy, Favorite. Battles stays inside Live.
- Motion honors `prefers-reduced-motion`; all timing uses tabular numerals.

## Data integrity rules

- Missing provider fields render as `Unavailable` or an explicit empty state.
- SC, VSC and red flag disable predictive widgets rather than presenting stale confidence.
- Derived numbers retain evidence and confidence labels.
- No annual standings, weather, radio, driver photography, or telemetry is synthesized.
- Circuit images must match the approved Formula 1 Media URL. Load failure or URL drift renders an explicit unavailable state, never a substitute outline.

## Reproducible review

Run the production server, then:

```bash
AUDIT_BASE_URL=http://127.0.0.1:3000 pnpm audit:ui
VISUAL_BASE_URL=http://127.0.0.1:3000 pnpm visual:capture
```

The audit also covers Season indexes and a circuit profile at 320 and 1280 pixels. Captures are written to `/tmp/f1-visuals` by default.
