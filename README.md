# F1 Race Weekend Companion

PWA mobile-first para usar como segunda pantalla durante un fin de semana de Fórmula 1. Convierte timing crudo en contexto accionable: batallas, ritmo de vueltas limpias, neumáticos, ventanas de alcance, proyecciones de salida de boxes, mensajes de dirección de carrera y explicaciones determinísticas.

- **Producción:** [f1.diegodella.ar](https://f1.diegodella.ar/weekend)
- **Modo público actual:** replay determinístico, sin login ni credenciales
- **Estado:** release `1.0.0`

> Proyecto independiente y no afiliado, patrocinado ni aprobado por Formula 1, FIA, equipos o pilotos. Las marcas pertenecen a sus respectivos titulares.

## Qué incluye

- Timing tower responsive con orden, intervalos, compuesto, edad del neumático y ritmo.
- Detección de batallas con closing rate, rango de alcance, confianza y contexto DRS.
- Proyección conservadora de rejoin y señales de undercut; no muestra precisión falsa cuando faltan datos.
- Mensajes prioritarios de Race Control y desactivación automática de predicciones bajo SC, VSC o bandera roja.
- Detalle de piloto, comparación, circuito, preferencias locales y vista post-carrera provisional.
- Explicaciones determinísticas: cada número visible en “Explain” está respaldado por evidencia estructurada.
- Replay reproducible con play/pause, 1×/4×/16×, seek y reset.
- REST BFF + SSE con snapshots, patches versionados, heartbeat y fallback a polling.
- PWA instalable con shell y último snapshot disponibles offline.
- Adaptador OpenF1 histórico y soporte live autenticado mediante OAuth2.

No incluye cuentas, base de datos, publicidad, noticias, apuestas, standings anuales ni telemetría inventada.

## Arquitectura

```text
OpenF1Adapter ─┐
               ├─ SessionSnapshot normalizado ─ SessionEngine ─ REST/SSE BFF ─ Next PWA
ReplayAdapter ─┘                              ├─ métricas puras
                                             ├─ insights determinísticos
                                             ├─ cache/coalescing/circuit breaker
                                             └─ delay ring de 0/30/60/120 s
```

El frontend nunca consume tipos del proveedor. Todo dato atraviesa contratos Zod internos; campos ausentes permanecen `null`. La separación permite cambiar de replay a OpenF1 sin modificar la UI.

```text
apps/web             Next.js App Router, BFF, SSE, UI y service worker
packages/domain      contratos, métricas, estados e insights puros
packages/providers   replay, OpenF1, normalización y SessionEngine
packages/ui          primitivas compartidas
fixtures             carrera completa + timeline NDJSON
deploy               unidad systemd
scripts              deploy atómico y smokes
docs                 arquitectura y runbook de producción
```

Más detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Inicio rápido

Requisitos: Node.js 22+, Corepack y pnpm 10.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Abrir <http://localhost:3000/weekend>. El proveedor por defecto es replay y no necesita red ni secretos.

### Variables de entorno

| Variable | Default | Uso |
|---|---:|---|
| `DATA_PROVIDER` | `replay` | `replay` u `openf1` |
| `ENABLE_REPLAY` | `true` | Habilita el endpoint de control de replay |
| `OPENF1_BASE_URL` | `https://api.openf1.org/v1` | API upstream |
| `OPENF1_USERNAME` | — | Usuario OAuth2 live; sólo servidor |
| `OPENF1_PASSWORD` | — | Password OAuth2 live; sólo servidor |
| `OPENF1_ACCESS_TOKEN` | — | Token efímero alternativo; sólo smoke |
| `NEXT_PUBLIC_APP_URL` | local | URL canónica del frontend |

Copiar siempre `.env.example`; los archivos `.env*` reales están ignorados por Git.

## Replay reproducible

Cada navegador recibe una sesión anónima aislada mediante cookie HttpOnly `f1c_replay_run`, con expiración de dos horas. Un usuario que avanza el replay no altera el estado de otro.

Timeline de demo:

- `0 ms`: carrera verde; PIA se acerca a LEC.
- `2000 ms`: VSC; batallas y predicciones quedan suspendidas.
- `3000 ms`: bandera verde.
- `4000 ms`: bandera a cuadros.
- `5000 ms`: resultado provisional.

Control por API, disponible sólo con `ENABLE_REPLAY=true`:

```bash
curl -X POST http://localhost:3000/api/v1/replay/control \
  -H 'content-type: application/json' \
  -d '{"action":"seek","sessionId":"session:replay:demo-race-2024","atMs":2100}'
```

## OpenF1

El histórico público funciona sin autenticación. El acceso en tiempo real requiere una suscripción compatible y OAuth2:

```dotenv
DATA_PROVIDER=openf1
OPENF1_USERNAME=operator@example.com
OPENF1_PASSWORD=<server-only-secret>
```

El adaptador limita solicitudes a una cada 400 ms, reintenta `429` hasta tres veces respetando `Retry-After` y coalesce la obtención del token. Los errores nunca incluyen credenciales.

Smoke histórico real:

```bash
OPENF1_SMOKE_SESSION=9165 pnpm smoke:openf1
```

Limitaciones verificadas:

- El orden de clasificación de OpenF1 no se presenta como orden físico garantizado.
- No hay estado exacto del detection point DRS ni distinción confiable final/provisional.
- Longitud, zonas DRS, pit loss y layout licenciado pueden faltar.
- Resultados históricos pueden publicarse después de la clasificación oficial.
- Sin credenciales live, producción conserva replay como demo funcional y no simula datos en vivo.

## API interna

Todos los endpoints viven bajo `/api/v1`.

| Endpoint | Propósito |
|---|---|
| `GET /weekend/current` | meeting y sesiones actuales |
| `GET /sessions/:id` | resumen de sesión |
| `GET /sessions/:id/snapshot` | snapshot normalizado y métricas derivadas |
| `GET /sessions/:id/stream` | SSE: snapshot, patch, health y heartbeat |
| `GET /sessions/:id/drivers/:driverId` | detalle de piloto |
| `GET /sessions/:id/compare` | comparación de pilotos |
| `GET /sessions/:id/battles` | batallas detectadas |
| `GET /sessions/:id/insights` | explicaciones determinísticas |
| `GET /sessions/:id/race-control` | feed de Race Control |
| `GET /tracks/:trackId` | contexto de circuito |
| `GET /health/data` | salud, proveedor y frescura |
| `GET /replay/sessions` | fixtures disponibles |
| `POST /replay/control` | play, pause, speed, seek y reset |

Los IDs contienen namespace (`session:replay:*`, `session:openf1:*`) para evitar colisiones.

## Calidad y pruebas

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm smoke:offline
pnpm smoke:openf1
```

Cobertura funcional actual:

- 41 tests unitarios/integración en 11 suites.
- 6 escenarios E2E en Chromium móvil y desktop.
- Payloads parciales/malformados, cache, coalescing, circuit breaker y replay clock.
- Métricas de pace, closing rate, catch range, DRS, tyre age, confianza, rejoin y undercut.
- Revisión segura de patches SSE y endpoints BFF.
- VSC, post-race, favoritos persistidos, comparación y accesibilidad de componentes.
- Smoke PWA mediante Chrome DevTools: manifest instalable, service worker, shell offline y 8 pilotos cacheados.

Última auditoría Lighthouse mobile local (2026-08-10): Accessibility 100, Best Practices 96, SEO 100, Performance 55. El objetivo de Performance es 85; la medición quedó desviada con el host en carga `13.5` sobre 4 CPU y swap al 100%, con 4.28 s de TBT atribuidos al runtime cliente. La desviación queda documentada y debe repetirse en un runner limpio antes de tomar decisiones de optimización.

## Seguridad y privacidad

- Sin login, tracking de terceros ni datos personales persistentes.
- Preferencias exclusivamente en `localStorage`.
- Cookie de replay aleatoria, HttpOnly, SameSite=Lax, Secure en producción y sin identidad.
- OAuth y upstream sólo del lado servidor.
- CSP, `nosniff`, Referrer Policy y Permissions Policy en todas las rutas.
- Cache y estado en memoria; no hay migraciones ni base de datos.
- Imágenes Docker y unidad systemd ejecutan como usuario no privilegiado.

Ver [SECURITY.md](SECURITY.md) para reporte y operación de secretos.

## Producción

La instancia oficial corre como un único proceso Node standalone:

```text
Cloudflare DNS/HTTPS
        ↓
Tunnel 55ecc138…
        ↓
127.0.0.1:3463
        ↓
f1-companion.service
        ↓
/home/diego/Documents/f1/current -> .releases/<timestamp>
```

Despliegue:

```bash
bash scripts/deploy_release.sh
bash scripts/prod_smoke.sh
```

El script instala con lockfile congelado, ejecuta lint/typecheck/tests/build, crea un release inmutable, cambia el symlink atómicamente, reinicia systemd y hace health checks. Si el nuevo proceso no queda sano restaura el symlink previo y reinicia automáticamente.

Runbook completo: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Docker

```bash
docker build -t f1-companion .
docker run --rm -p 3000:3000 --env-file .env.local f1-companion
```

## Límites operativos

Cache, coalescing, delay ring, controles de replay y rate limiting son process-local. Antes de escalar horizontalmente se necesita KV compartido, pub/sub para SSE y coordinación distribuida del replay. No existe una migración de base de datos pendiente.

## Contribuir

Consultar [CONTRIBUTING.md](CONTRIBUTING.md). El principio central es simple: degradar a `null`, stale u offline antes que inventar precisión.
