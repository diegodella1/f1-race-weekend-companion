# Runbook de producción

## Topología oficial

- Host público: `https://f1.diegodella.ar`
- Origin: `http://127.0.0.1:3463`
- Servicio: `f1-companion.service`
- Releases: `/home/diego/Documents/f1/.releases/<UTC timestamp>`
- Release activo: `/home/diego/Documents/f1/current`
- Tunnel: `55ecc138-2b04-4678-b3cf-5460da1aa1ff`

## Primer alta

```bash
sudo cp deploy/f1-companion.service /etc/systemd/system/f1-companion.service
sudo systemctl daemon-reload
sudo systemctl enable f1-companion.service
bash scripts/deploy_release.sh
```

Regla ingress, antes del fallback 404:

```yaml
- hostname: f1.diegodella.ar
  service: http://127.0.0.1:3463
```

Validar antes de reemplazar configuración:

```bash
cloudflared --config /tmp/config.yml tunnel ingress validate
cloudflared tunnel route dns 55ecc138-2b04-4678-b3cf-5460da1aa1ff f1.diegodella.ar
```

## Release habitual

```bash
bash scripts/deploy_release.sh
bash scripts/prod_smoke.sh
```

El deploy no borra releases anteriores. Conserva un target previo y lo restaura si restart o health checks fallan.

## Verificación

```bash
systemctl is-active f1-companion.service
curl --fail http://127.0.0.1:3463/api/v1/health/data
curl --fail https://f1.diegodella.ar/weekend
SMOKE_BASE_URL=https://f1.diegodella.ar pnpm smoke:offline
journalctl -u f1-companion.service -n 100 --no-pager
```

## Rollback manual

1. Identificar el release previo con `ls -lt .releases`.
2. Crear `current.next` apuntando al target exacto.
3. Reemplazar `current` con `mv -Tf current.next current`.
4. Reiniciar `f1-companion.service`.
5. Ejecutar smoke local y público.

Para retirar sólo la ruta pública, restaurar el backup de `/etc/cloudflared/config.yml`, validar y reiniciar `cloudflared.service`. No borrar DNS hasta confirmar que el origin previo está sano.

## OpenF1 live

Crear `/home/diego/Documents/f1/.env.production` con permisos restrictivos y sólo variables necesarias. Nunca incluirlo en un release o commit. Reiniciar el servicio después del cambio y validar `/api/v1/health/data` antes de exponer el modo live.
