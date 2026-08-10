# Arquitectura

## Objetivos

El sistema debe seguir siendo útil con datos incompletos, explicar cada inferencia y mantener la UI independiente del proveedor. Replay y OpenF1 implementan el mismo contrato `TimingProvider`.

## Flujo de datos

1. El adaptador obtiene datos upstream o eventos del fixture.
2. La normalización valida tipos y crea un `SessionSnapshot` interno.
3. `SessionEngine` coalesce solicitudes, usa LRU, circuit breaker y conserva una ventana de snapshots para delay.
4. Funciones puras calculan ritmo, batallas, rejoin y estrategia.
5. Insights determinísticos enlazan el texto visible con evidencia numérica.
6. El BFF entrega REST o SSE; la UI aplica patches sólo si su revisión es la esperada.
7. Si SSE cae, TanStack Query consulta snapshot cada 10 segundos.

## Fronteras

- `domain` no conoce HTTP, Next.js ni proveedores.
- `providers` puede importar `domain`, nunca componentes.
- `web` consume contratos internos, nunca payloads OpenF1.
- `ui` contiene primitivas presentacionales sin reglas de carrera.

## Estado y consistencia

Cada snapshot tiene `revision`, `sourceUpdatedAt`, edad y estado de salud. Los patches declaran revisión base y siguiente; ante un salto el cliente descarta el patch y vuelve a pedir snapshot.

SC, VSC y bandera roja hacen que proyecciones sensibles queden deshabilitadas. Un dato stale puede seguir visible con etiqueta; un dato ausente permanece `null`.

## Aislamiento de replay

`proxy.ts` crea la cookie anónima `f1c_replay_run`. El runtime mantiene hasta 100 instancias LRU asociadas a esa cookie. OpenF1 usa un runtime compartido porque representa una fuente global; replay no.

## Resiliencia

- Request coalescing evita duplicar llamadas simultáneas.
- Cache LRU sirve último dato sano dentro de límites definidos.
- Circuit breaker reduce presión sobre un upstream degradado.
- OpenF1 aplica pacing, `Retry-After` y reintentos acotados.
- SSE emite health y heartbeat y se reconecta desde el cliente.
- Service worker usa network-first para navegación/snapshot y cache-first para assets.

## Escalado

La release actual es deliberadamente single-instance. Escalado horizontal requiere externalizar cache, rate limiting, replay runtimes, delay ring y distribución de eventos SSE.
