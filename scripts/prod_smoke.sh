#!/usr/bin/env bash
set -euo pipefail

base_url=${F1_BASE_URL:-https://f1.diegodella.ar}
session_id=session:replay:hungary-race-2026

curl --fail --silent --show-error --max-time 15 "$base_url/weekend" >/dev/null
curl --fail --silent --show-error --max-time 15 "$base_url/strategy" >/dev/null
curl --fail --silent --show-error --max-time 15 "$base_url/track" >/dev/null
curl --fail --silent --show-error --max-time 15 "$base_url/compare" >/dev/null
curl --fail --silent --show-error --max-time 15 "$base_url/season" >/dev/null
curl --fail --silent --show-error --max-time 15 "$base_url/manifest.webmanifest" >/dev/null
health=$(curl --fail --silent --show-error --max-time 15 "$base_url/api/v1/health/data")
snapshot=$(curl --fail --silent --show-error --max-time 15 "$base_url/api/v1/sessions/$session_id/snapshot?delay=0")
catalog=$(curl --fail --silent --show-error --max-time 15 "$base_url/api/v1/season/2026")

node -e '
const health = JSON.parse(process.argv[1]);
const snapshot = JSON.parse(process.argv[2]);
const catalog = JSON.parse(process.argv[3]);
if (health.provider !== "replay") throw new Error("Unexpected provider");
if (health.state !== "fresh" || !health.lastSuccessAt) throw new Error("Replay health is not fresh");
if (!Array.isArray(snapshot.drivers) || snapshot.drivers.length !== 22) throw new Error("Incomplete replay snapshot");
if (!Array.isArray(snapshot.battles)) throw new Error("Derived battles missing");
if (catalog.drivers?.length !== 22 || catalog.teams?.length !== 11 || catalog.circuits?.length !== 25) throw new Error("Incomplete 2026 catalog");
' "$health" "$snapshot" "$catalog"

echo "Production smoke passed: $base_url"
