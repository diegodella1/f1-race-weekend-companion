# F1 Race Weekend Companion

PWA mobile-first para usar como segunda pantalla durante un fin de semana de Fórmula 1. Convierte timing crudo en contexto accionable: batallas, ritmo de vueltas limpias, neumáticos, ventanas de alcance, proyecciones de salida de boxes, mensajes de dirección de carrera y explicaciones determinísticas. La interfaz Apex Velocity combina un HUD oscuro de alta densidad con tipografía y visualizaciones locales, sin depender de CDNs.

- **Producción:** [f1.diegodella.ar](https://f1.diegodella.ar/weekend)
- **Modo público actual:** replay determinístico, sin login ni credenciales
- **Estado:** desplegado y operado como servicio productivo

> Proyecto independiente y no afiliado, patrocinado ni aprobado por Formula 1, FIA, equipos o pilotos. Las marcas pertenecen a sus respectivos titulares.

## Qué incluye

- Timing tower responsive con orden, intervalos, compuesto, edad del neumático y ritmo.
- Detección de batallas con closing rate, rango de alcance, confianza y contexto DRS.
- Proyección conservadora de rejoin y señales de undercut; no muestra precisión falsa cuando faltan datos.
- Análisis dedicado en `/strategy` para comparar dos pilotos: delta de vueltas limpias, stint actual, edad de neumático, señales con evidencia y rejoin estimado.
- Mensajes prioritarios de Race Control y desactivación automática de predicciones bajo SC, VSC o bandera roja.
- Detalle de piloto, comparación por sectores, mapa de circuito con líderes reales, preferencias locales y clasificación post-carrera completa.
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
dsn                  ZIP original usado como referencia visual; no participa del runtime
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

## Rutas de producto

| Ruta | Función | Fuente de datos |
|---|---|---|
| `/weekend` | Live timing, batalla crítica, Race Control y resumen de estrategia | `SessionSnapshot` + SSE |
| `/strategy?a=&b=` | Pace delta y estrategia entre dos pilotos | vueltas limpias, stints, señales y pit projections |
| `/track` | Layout, métricas, DRS y líderes por sector | catálogo del circuito + snapshot de sesión |
| `/compare?a=&b=` | Head-to-head, sectores y trazas de ritmo | snapshot normalizado |
| `/drivers/:driverId` | Stints, últimas vueltas y rival inmediato | snapshot normalizado |
| `/settings` | Favorito, delay, zona horaria y ahorro de datos | `localStorage`, sin cuenta |

La navegación primaria es Live / Track / Strategy / Favorite. Battles permanece dentro de Live porque es contexto de carrera, no una sección independiente.

## Diseño Apex Velocity

- Chivo Variable para títulos, Hanken Grotesk Variable para lectura y JetBrains Mono Variable para timing; las tres fuentes se sirven desde el bundle.
- Paleta carbón con salmón `#ffb4a7`, cian `#00d2ff` y colores de estado reservados para condiciones de pista.
- Iconos SVG locales, fondos CSS y layout responsive probado desde 320 hasta 1280 px.
- El ZIP de `dsn/` se conserva como fuente de dirección visual. La implementación adapta su lenguaje sin copiar telemetría, standings, clima, radio, fotos ni posiciones que el proveedor no entrega.

Mapeo completo de cada mockup, dato real y descarte: [docs/design/APEX_VELOCITY.md](docs/design/APEX_VELOCITY.md).

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
AUDIT_BASE_URL=http://127.0.0.1:3000 pnpm audit:ui
VISUAL_BASE_URL=http://127.0.0.1:3000 pnpm visual:capture
pnpm smoke:offline
pnpm smoke:openf1
```

Cobertura funcional actual:

- 51 tests unitarios/integración para dominio, proveedores, BFF, navegación, Strategy y componentes de carrera.
- 8 ejecuciones E2E en Chromium móvil y desktop, incluidos replay, VSC, post-race, comparación y Strategy.
- Payloads parciales/malformados, cache, coalescing, circuit breaker y replay clock.
- Métricas de pace, closing rate, catch range, DRS, tyre age, confianza, rejoin y undercut.
- Revisión segura de patches SSE y endpoints BFF.
- VSC, post-race, favoritos persistidos, comparación y accesibilidad de componentes.
- Smoke PWA mediante Chrome DevTools: manifest instalable, service worker, shell offline y snapshot cacheado.
- `audit:ui` ejecuta Axe y detección de overflow sobre Weekend, Strategy, Track, Compare y Settings a 320 y 1280 px.
- `visual:capture` genera capturas reproducibles en `/tmp/f1-visuals` sin ensuciar el repositorio.

La auditoría UI local de esta release terminó sin violaciones Axe y sin overflow horizontal en las rutas auditadas. El JS inicial de `/weekend` ocupa 167 KiB transferidos incluyendo el framework, por debajo del presupuesto de 220 KiB aun antes de excluir React/Next. Lighthouse mobile local dio 67/100/100/100 con throttling simulado (TBT 1.68 s) y 100/100/100/100 usando la capacidad real del host (TBT 0 ms, CLS 0). La diferencia queda documentada: el score simulado debe repetirse en un runner limpio antes de usarlo como gate de rendimiento.

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
