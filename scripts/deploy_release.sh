#!/usr/bin/env bash
set -euo pipefail

project_root=/home/diego/Documents/f1
release_id=$(date -u +%Y%m%dT%H%M%SZ)
release_dir="$project_root/.releases/$release_id"
previous_target=""

cd "$project_root"
if test -L "$project_root/current"; then
  previous_target=$(readlink -f "$project_root/current")
fi

pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build

mkdir -p "$release_dir/apps/web/.next"
cp -a apps/web/.next/standalone/. "$release_dir/"
cp -a apps/web/.next/static "$release_dir/apps/web/.next/static"
cp -a apps/web/public "$release_dir/apps/web/public"
cp -a fixtures "$release_dir/fixtures"

ln -sfn "$release_dir" "$project_root/current.next"
mv -Tf "$project_root/current.next" "$project_root/current"

if ! sudo systemctl restart f1-companion.service; then
  if test -n "$previous_target"; then
    ln -sfn "$previous_target" "$project_root/current.next"
    mv -Tf "$project_root/current.next" "$project_root/current"
    sudo systemctl restart f1-companion.service
  fi
  exit 1
fi

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3463/api/v1/health/data >/dev/null \
    && curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3463/weekend >/dev/null; then
    echo "F1 Companion release healthy: $release_dir"
    exit 0
  fi
  sleep 1
done

if test -n "$previous_target"; then
  ln -sfn "$previous_target" "$project_root/current.next"
  mv -Tf "$project_root/current.next" "$project_root/current"
  sudo systemctl restart f1-companion.service
fi
echo "F1 Companion failed health checks; previous release restored" >&2
exit 1
