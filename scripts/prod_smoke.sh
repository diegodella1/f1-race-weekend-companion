#!/usr/bin/env bash
set -euo pipefail

base_url=${F1_BASE_URL:-https://f1.diegodella.ar}
session_id=session:replay:demo-race-2024

curl --fail --silent --show-error --max-time 15 "$base_url/weekend" >/dev/null
curl --fail --silent --show-error --max-time 15 "$base_url/manifest.webmanifest" >/dev/null
health=$(curl --fail --silent --show-error --max-time 15 "$base_url/api/v1/health/data")
snapshot=$(curl --fail --silent --show-error --max-time 15 "$base_url/api/v1/sessions/$session_id/snapshot?delay=0")

node -e '
const health = JSON.parse(process.argv[1]);
const snapshot = JSON.parse(process.argv[2]);
if (health.provider !== "replay") throw new Error("Unexpected provider");
if (!Array.isArray(snapshot.drivers) || snapshot.drivers.length < 8) throw new Error("Incomplete replay snapshot");
if (!Array.isArray(snapshot.battles)) throw new Error("Derived battles missing");
' "$health" "$snapshot"

echo "Production smoke passed: $base_url"
