# PRD tecnico — F1 Race Weekend Companion

**Estado:** listo para implementacion
**Version:** 1.0
**Objetivo de entrega:** MVP end-to-end, mobile-first y PWA, util durante un fin de semana real de Formula 1 y completamente demostrable mediante replay.
**Principio de producto:** no es una app general de F1. Es una segunda pantalla que traduce timing, ritmo, neumaticos, batallas y estrategia en contexto accionable mientras ocurre un GP.

---

## 1. Resumen ejecutivo

Construir una PWA gratuita centrada exclusivamente en el race weekend. La aplicacion cambia de modo segun la sesion: pre-weekend, practice, qualifying, race y post-race. **Race Mode es el nucleo** y debe concentrar la mayor calidad de producto.

La app debe responder, en menos de cinco segundos de lectura, estas preguntas:

1. ¿Que esta pasando ahora?
2. ¿Que batalla importa y quien se acerca?
3. ¿Que papel cumplen neumaticos, ritmo y posibles paradas?
4. ¿Que le esta pasando a mi piloto favorito?
5. ¿Que evento de race control acaba de cambiar la carrera?

No se deben inventar datos. Toda afirmacion debe derivarse de campos disponibles o presentarse como estimacion con nivel de confianza y supuestos visibles.

## 2. Objetivos y metricas del MVP

### Objetivos

- Funcionar end-to-end con un proveedor live compatible y con replay local.
- Dar contexto superior a un leaderboard sin pretender reemplazar la transmision.
- Cargar rapidamente en una red movil inestable y degradar con elegancia.
- Permitir seguir un piloto favorito y comparar dos pilotos.
- Mantener una unica base de codigo desplegable gratuitamente o a bajo costo.

### Metricas de producto

- `session_view_started`: una sesion live o replay llega a estado ready.
- `favorite_driver_selected`: porcentaje de usuarios que elige favorito.
- `battle_opened`: apertura de una Battle Card.
- `driver_compare_opened`: comparacion iniciada.
- `explain_opened`: uso de “What matters now”.
- `return_same_weekend`: retorno durante el mismo GP, medido anonimamente.
- Frescura mediana visible de datos menor a 10 s durante carrera cuando el proveedor lo permite.
- Error-free session mayor a 99% en cliente.

No se requiere login, perfil remoto ni identificacion personal.

## 3. Personas y jobs to be done

### Fan casual

Quiere entender por que una diferencia, parada o bandera importa sin interpretar veinte columnas.

### Fan informado

Quiere gaps, ritmo limpio, edad de neumatico, tendencia, ventana de pit y comparaciones sin ruido.

### Usuario que sigue a un piloto

Quiere que el estado del favorito permanezca visible y recibir contexto relevante aunque la TV siga otra batalla.

## 4. Alcance funcional

### 4.1 Estados de producto

1. **Pre-weekend:** proxima carrera, circuito, hora local, sesiones proximas y selector de favorito.
2. **Practice:** clasificacion, mejor/ultima vuelta, compuesto, tanda, ritmo de tanda larga y eventos relevantes.
3. **Qualifying:** Q1/Q2/Q3, tiempo restante, cutoff, riesgo de eliminacion, vuelta actual y mejora por sectores cuando exista.
4. **Race:** leaderboard enriquecido, favorito, batallas, gaps, ritmo, neumaticos/stints, estrategia, race control y Explain.
5. **Post-race:** clasificacion final/provisional, cambios principales, resumen deterministico y proxima carrera.

### 4.2 Navegacion primaria

- `/` redirige a `/weekend`.
- `/weekend` muestra el estado adecuado segun la maquina de estados.
- `/drivers/:driverId` detalle de piloto.
- `/compare?a=:driverId&b=:driverId` comparacion.
- `/track` circuito y contexto basico.
- `/settings` favorito, delay, unidades, zona horaria y replay.

Durante una sesion live, la barra inferior contiene: **Live**, **Battles**, **Track**, **Favorite**. Explain se abre como bottom sheet desde Live.

## 5. Requisitos por modo

### 5.1 Pre-weekend

- Nombre oficial corto del GP, pais/bandera, circuito y rango de fechas.
- Proxima sesion en primer plano con countdown y hora local.
- Solo las sesiones del GP actual/proximo.
- Una linea discreta con la carrera inmediatamente posterior, sin calendario completo.
- Estado de disponibilidad: “Live data starts near session time”.
- Elegir o cambiar Favorite Driver.

### 5.2 Practice

- Posicion, piloto, mejor vuelta, delta al lider, ultima vuelta, compuesto y edad del stint.
- Ritmo de ultimas 3 y 5 vueltas limpias.
- Identificar long run solo despues de 5 vueltas limpias consecutivas del mismo stint.
- Eventos: mejor sector, cambio de compuesto, inicio de long run, bandera y race control.
- No declarar “degradacion” como hecho; usar “tendencia de tiempos” y mostrar confianza.

### 5.3 Qualifying

- Fase Q1/Q2/Q3 y reloj.
- Linea de cutoff (P15/P10 segun fase; configurable por reglamento/session metadata).
- Margen al cutoff, pilotos en riesgo y estado on-track/in-pit.
- Progreso de sectores de vuelta actual cuando la fuente lo permita.
- “Needs ~0.04s” se calcula contra el tiempo del ultimo clasificado, nunca contra una prediccion opaca.
- Al terminar cada fase, congelar clasificacion hasta confirmar la siguiente fase.

### 5.4 Race Mode — nucleo

#### Header fijo

- GP, vuelta actual/total, bandera/estado, frescura del dato y control de delay.
- En SC/VSC/red flag, el estado debe dominar visualmente.

#### Leaderboard enriquecido

Por piloto: posicion, abreviatura, gap al lider o interval al de adelante, compuesto, edad del stint, ultimo pit, ultima vuelta y tendencia de ritmo. En pantallas angostas, ocultar campos secundarios, no reducir tipografia por debajo de 14 px.

#### Favorite Driver strip

Siempre visible o sticky: posicion, gap delante/detras, neumatico, edad, ritmo ultimas 5 limpias y batalla mas cercana. Tocar abre detalle.

#### Automatic Battles

Mostrar hasta tres batallas ordenadas por relevancia, con texto como:

> PIA esta a 1.4 s de LEC y recorta ~0.18 s/vuelta. Podria entrar en DRS en 2–4 vueltas. Confianza media.

Cada card debe mostrar datos base, timestamp y razon de confianza. Nunca afirmar adelantamiento futuro.

#### Tyres & stints

- Compuesto actual, vuelta de inicio, edad y pits.
- Historial de stints en una linea horizontal.
- Diferenciar compuesto desconocido de dato atrasado.
- “Old tyre” solo en comparacion con la distribucion del mismo compuesto en la sesion.

#### Pit window / strategy

- Estimar perdida de pit configurable por circuito y fallback global.
- Proyectar posicion de rejoin con gaps actuales y pit loss.
- Marcar autos cercanos a la posicion de rejoin.
- Detectar oportunidad de undercut/overcut como heuristica, no recomendacion cierta.
- Desactivar predicciones bajo SC/VSC/red flag o cuando la confianza sea baja.

#### Race control

- Feed cronologico normalizado: flags, SC/VSC, incident noted/investigation, penalties y mensajes.
- Prioridad alta aparece como banner y se puede descartar.
- Conservar texto fuente y, opcionalmente, etiqueta traducida deterministica.

#### Explain / What matters now

Bottom sheet con 3–5 items ordenados por impacto:

- cambio de estado de carrera;
- amenaza al favorito;
- batalla con alta tasa de cierre;
- ventana de parada relevante;
- cambio de lider/posicion;
- neumaticos o ritmo divergente.

Cada item contiene `headline`, `evidence`, `confidence`, `updatedAt` y enlace al dato subyacente.

### 5.5 Driver detail

- Posicion, estado, compuesto/edad y pits.
- Gaps delante/detras.
- Mejor, ultima y media de ultimas 3/5 vueltas limpias.
- Historial de vueltas compacto y stints.
- Sectores y telemetria resumida solo si existe.
- CTA Compare, preseleccionando al rival inmediato.

### 5.6 Driver compare

- Dos selectores, persistiendo el favorito como A por defecto.
- Posicion, gap, compuesto/edad, pits, best lap, pace 3/5, sectores y tendencia.
- Grafico de lap time solo con clean laps, marcando pits/SC.
- Si la cobertura difiere, mostrar “data unavailable”; no completar por inferencia.

### 5.7 Track

- Nombre, pais, longitud, numero de vueltas y pit-loss estimado.
- Imagen/SVG local y accesible del trazado si se dispone de licencia compatible.
- Sectores y zonas DRS si el proveedor o fixture las incluye.
- Clima actual solo durante el weekend y solo si forma parte del feed.
- Nada de historia, noticias ni guia turistica.

### 5.8 Post-race

- Resultado final o “provisional” claramente etiquetado.
- Ganador, podio, favorito y cambios netos de posicion.
- 3–5 hechos deterministas del race feed.
- Link a replay de la sesion si existe.
- Proxima carrera y proxima sesion; no calendario completo.

## 6. Fuera de alcance — estricto

- Noticias, articulos, social feed, X/Twitter, rumores o contenido editorial.
- Calendario anual completo, standings del campeonato o fantasy.
- Video, audio/radio en vivo o contenido protegido sin licencia.
- Login, cuentas, pagos, ads, chat, comentarios o notificaciones push en MVP.
- Predicciones de ganador, apuestas o probabilidades de gambling.
- Simulacion estrategica avanzada, ML entrenado, modelos de degradacion fisica o datos no observables (temperatura real del neumatico, fuel load).
- Admin CMS, app nativa, smartwatch, tablet layout dedicado o desktop-first.
- Traduccion libre de mensajes mediante LLM sin evidencia.
- Scraping del sitio oficial o dependencia de endpoints no autorizados.

## 7. Arquitectura recomendada

### Stack

- **Monorepo:** pnpm workspaces.
- **Frontend/BFF:** Next.js 15+ App Router, TypeScript strict, React, Tailwind CSS, shadcn/ui solo donde reduzca trabajo.
- **Client state:** TanStack Query para server state; Zustand pequeño para preferencias/UI efimera.
- **Validation:** Zod en limites de red y fixtures.
- **Charts:** Recharts o SVG propio; evitar librerias pesadas.
- **Tests:** Vitest, Testing Library, Playwright.
- **PWA:** manifest + service worker via Serwist o implementacion equivalente compatible con Next.
- **Deploy:** Vercel/Cloudflare compatible. El adapter nunca debe exponer API keys al browser.

### Diagrama

```text
Provider (OpenF1/otro)
          |
          v
  Provider Adapter ---- Replay Adapter (JSON/NDJSON)
          |                    |
          +------ Normalizer --+
                    |
              Session Engine
        (snapshots + derived metrics)
                    |
            BFF /api/v1/* + SSE
                    |
       TanStack Query / event stream
                    |
                  PWA
```

### Principios

- La UI solo consume modelos normalizados internos.
- Adapter del proveedor y adapter replay implementan la misma interfaz.
- Los calculos derivados son funciones puras, compartibles entre servidor y tests.
- Snapshot completo para bootstrap; eventos incrementales para actualizacion.
- El MVP debe funcionar con polling aun si SSE/WebSocket no esta disponible.

## 8. Integracion de datos

### Interface del provider

```ts
export interface TimingProvider {
  getMeetings(range: DateRange): Promise<ProviderMeeting[]>;
  getSessions(meetingId: string): Promise<ProviderSession[]>;
  getSessionSnapshot(sessionId: string): Promise<ProviderSnapshot>;
  getUpdates(sessionId: string, since?: string): Promise<ProviderUpdateBatch>;
  getHistoricalSession(sessionId: string): Promise<ProviderSnapshot>;
  capabilities(): ProviderCapabilities;
}
```

Crear inicialmente `OpenF1Adapter` y `ReplayAdapter`. Si el proveedor no ofrece un campo, declarar capability `false` y degradar la UI.

### Normalizacion

- IDs internos estables: `meeting:<provider>:<id>`, `session:...`, `driver:<number>:<season>`.
- Convertir timestamps a ISO UTC; renderizar en zona local del usuario.
- Segundos como `number`; milisegundos solo en timestamps.
- `null` significa conocido pero ausente/no disponible; nunca usar `0` como desconocido.
- Conservar `sourceUpdatedAt`, `ingestedAt` y `provider`.
- Deduplicar por entidad + timestamp/version.
- Ordenar race control por tiempo fuente, resolviendo empates con ingestion order.

### Polling, SSE y WebSocket

- Browser hace bootstrap por REST y se conecta a SSE `/api/v1/sessions/:id/stream`.
- Servidor mantiene polling del upstream si el proveedor no tiene push.
- Frecuencias objetivo:
  - posiciones/gaps: 3–5 s live;
  - laps/stints/race control: 5 s;
  - clima/session metadata: 30–60 s;
  - pre/post session: 5 min / 30 s hasta estabilizar resultado.
- Aplicar jitter ±15%, exponential backoff (2, 4, 8, 16, 30 s), y respetar `Retry-After`.
- Si SSE falla, cliente vuelve a polling de snapshot cada 10 s y muestra modo degradado.
- WebSocket solo si el proveedor lo requiere; no es requisito del cliente MVP.

### Cache y rate limits

- Cache in-memory LRU en desarrollo; abstraccion `CacheStore` preparada para Redis/KV.
- TTL live 2–5 s, weekend metadata 5 min, historical 24 h.
- Request coalescing por `sessionId` para que multiples clientes compartan fetch.
- Stale-while-revalidate: servir snapshot de hasta 30 s con `stale: true`.
- Circuit breaker tras 5 fallos consecutivos; half-open a los 30 s.
- Al recibir 429: respetar header, servir cache y elevar `DataHealth.rateLimited`.

### Delay opcional

- Preferencia `syncDelaySeconds`: 0, 10, 20, 30, 45 o 60.
- El servidor mantiene un ring buffer de eventos de al menos 90 s; el cliente solicita `?delay=30`.
- Si no hay buffer suficiente, mostrar el delay efectivo, no prometer el elegido.
- Race control, leaderboard y Explain deben usar el mismo reloj retrasado.

## 9. Modelos de dominio

```ts
type Confidence = 'high' | 'medium' | 'low' | 'unavailable';
type SessionKind = 'practice' | 'qualifying' | 'sprint' | 'race';
type SessionPhase =
  | 'scheduled' | 'pre_live' | 'live' | 'suspended'
  | 'finishing' | 'finished_provisional' | 'finished_final' | 'unavailable';

interface DataMeta {
  provider: string;
  sourceUpdatedAt: string | null;
  ingestedAt: string;
  stale: boolean;
  ageSeconds: number;
}

interface Meeting {
  id: string; name: string; countryCode: string; circuitId: string;
  startsAt: string; endsAt: string; sessions: SessionSummary[];
  nextMeeting?: Pick<Meeting, 'id' | 'name' | 'startsAt'>;
}

interface SessionSnapshot {
  id: string; meetingId: string; kind: SessionKind; phase: SessionPhase;
  segment?: 'Q1' | 'Q2' | 'Q3'; startedAt: string | null; endsAt: string | null;
  clockSeconds: number | null; lap: number | null; totalLaps: number | null;
  trackStatus: TrackStatus; drivers: DriverState[]; raceControl: RaceControlEvent[];
  battles: Battle[]; insights: Insight[]; meta: DataMeta;
}

interface DriverState {
  driverId: string; number: number; code: string; fullName: string;
  teamName: string; teamColor: string | null; position: number | null;
  status: 'running' | 'pit' | 'retired' | 'dns' | 'finished' | 'unknown';
  gapToLeaderSec: number | null; intervalAheadSec: number | null;
  lastLapSec: number | null; bestLapSec: number | null;
  pace3Sec: number | null; pace5Sec: number | null;
  currentStint: Stint | null; stints: Stint[]; laps: Lap[];
}

interface Lap {
  lapNumber: number; timeSec: number | null; sectorsSec: Array<number | null>;
  startedAt: string | null; compound: TyreCompound | null;
  isPitIn: boolean; isPitOut: boolean; trackStatus: TrackStatusCode;
  clean: boolean; exclusionReasons: string[];
}

interface Stint {
  index: number; compound: TyreCompound | null; startLap: number;
  endLap: number | null; tyreAgeAtStart: number | null; currentAgeLaps: number | null;
}

interface Battle {
  id: string; aheadDriverId: string; behindDriverId: string;
  gapSec: number; closingRateSecPerLap: number | null;
  projectedCatchLaps: number | null; drsState: 'inside' | 'approaching' | 'outside' | 'unknown';
  relevanceScore: number; confidence: Confidence; evidence: string[];
}

interface PitProjection {
  driverId: string; estimatedPitLossSec: number; projectedRejoinPosition: number | null;
  projectedAheadDriverId: string | null; projectedBehindDriverId: string | null;
  confidence: Confidence; disabledReason?: string;
}

interface Insight {
  id: string; type: 'race_status' | 'favorite' | 'battle' | 'strategy' | 'pace' | 'tyres';
  priority: number; headline: string; evidence: string[];
  confidence: Confidence; updatedAt: string; entityRefs: string[];
}
```

## 10. Endpoints internos

Todos bajo `/api/v1`; respuestas validadas con Zod.

- `GET /weekend/current` — GP actual/proximo, sesiones y siguiente carrera.
- `GET /sessions/:id` — metadata y estado.
- `GET /sessions/:id/snapshot?delay=0` — snapshot normalizado y derivados.
- `GET /sessions/:id/stream?delay=0` — SSE con `snapshot`, `patch`, `health`, `heartbeat`.
- `GET /sessions/:id/drivers/:driverId` — detalle.
- `GET /sessions/:id/compare?a=&b=` — vista comparada.
- `GET /sessions/:id/battles` — batallas ordenadas.
- `GET /sessions/:id/insights` — Explain.
- `GET /sessions/:id/race-control?cursor=` — feed paginado.
- `GET /tracks/:trackId` — metadata.
- `GET /health/data` — provider, cache, rate limit, last success.
- `GET /replay/sessions` y `POST /replay/control` solo en development o con `ENABLE_REPLAY=true`.

Errores siguen `{ code, message, retryable, requestId }`; no filtrar errores upstream ni secretos.

## 11. Maquina de estados

```text
scheduled -> pre_live -> live -> finishing -> finished_provisional -> finished_final
                         |  ^         |
                         v  |         v
                      suspended -----+

cualquier estado -> unavailable (solo por falta prolongada de metadata)
```

Reglas:

- `pre_live`: desde 30 min antes o cuando aparece timing.
- `live`: señal explicita del proveedor o datos de vuelta/clock recientes.
- `suspended`: red flag/session stopped; conserva snapshot.
- `finishing`: reloj 0 o bandera a cuadros, esperando clasificacion completa.
- `finished_provisional`: resultado disponible pero no final.
- `finished_final`: fuente lo confirma o, si no existe la distincion, mantener provisional.
- Nunca retroceder de final a live salvo reset explicito del provider con nueva version.

## 12. Algoritmos y heuristicas

Todas las ventanas son configurables en `packages/domain/src/config.ts` y testeadas con fixtures.

### Clean laps

Una vuelta es limpia si tiene tiempo valido y no es pit-in/out, no ocurre bajo SC/VSC/red flag, no es primera vuelta, no contiene bandera amarilla relevante si esta disponible, y su tiempo no excede `median(last 7 valid) * 1.07`. El filtro del 7% elimina trafico/outliers, pero se registra la razon. En practice puede relajarse a 10%.

### Pace last N

`paceN = trimmedMean(last N clean lap times)`. Para N=5, eliminar max y min si hay 5; para N=3 usar media simple. Requiere minimo 3 clean laps. Mostrar muestra real (`3 laps`).

### Battle detection

Candidato si los pilotos son adyacentes en pista/clasificacion, ambos running y `0 < gap <= 3.0 s`. Incluir no adyacente solo si la fuente ofrece orden fisico confiable. Excluir SC/VSC/red flag y autos separados por una vuelta salvo recuperacion de lap explicitamente soportada.

`relevanceScore` de 0–100:

```text
45 * proximityScore        // 1 a <=0.5s, 0 a >=3s
+ 25 * closingScore        // 1 a >=0.30 s/lap
+ 15 * drsScore            // 1 dentro, .6 aproximandose
+ 10 * favoriteScore       // 1 si participa favorito
+  5 * positionScore       // mayor para top 10
```

Publicar maximo 3, suprimiendo duplicados del mismo par por 30 s.

### Closing rate

Usar la pendiente robusta del gap de las ultimas 3–5 vueltas limpias comunes. Alternativa: `paceAhead5 - paceBehind5`. Positivo significa que el de atras cierra. Ignorar muestras bajo bandera/pit. Limitar visualmente a ±1.5 s/lap y marcar baja confianza si hay menos de 3 muestras.

### Projected catch

Si `closingRate >= 0.05` y `gap > targetGap`, entonces:

`catchLaps = (gap - targetGap) / closingRate`.

- Para contacto usar `targetGap=0.3`.
- Para DRS usar `targetGap=1.0` en el punto de deteccion como aproximacion.
- Mostrar rango, no exactitud: ±1 vuelta high, ±2 medium, o `3+` low.
- Ocultar si >10 vueltas, quedan menos vueltas, hay flags o tendencia inestable.

### DRS

- `inside`: gap <=1.0 s y DRS habilitado conocido.
- `approaching`: gap >1.0 y <=1.8, closingRate >=0.05.
- `outside`: resto.
- `unknown`: DRS status/gap no confiable.

El texto debe decir “en rango estimado” si no existe dato del detection point.

### Tyre age

`currentAge = currentLap - stint.startLap + 1 + (tyreAgeAtStart ?? 0)`. Si falta start lap, inferir de pit-out y bajar confianza. Nunca inferir compuesto.

### Pit/rejoin

1. `pitLoss = circuit.pitLossSec ?? medianHistoricalPitLoss ?? 22`.
2. `projectedRaceTime = driver.gapToLeaderSec + pitLoss + pitServiceAdjustment`.
3. Comparar contra gaps proyectados de otros autos en la misma vuelta.
4. Rejoin position es el numero de autos con gap proyectado menor + 1.
5. Ajuste de servicio por defecto 0 porque pit loss debe ser loss total; aplicar solo si la fuente define que no lo incluye.

Confianza high requiere pit loss especifico del circuito, gaps recientes <5 s y green flag; medium admite datos <15 s; low se muestra solo como “zona estimada”, sin posicion exacta.

### Undercut/overcut

- **Undercut candidate:** perseguidor a <=3 s, neumaticos no mas viejos o ritmo >=0.15 s/lap mejor, rejoin en aire limpio estimado y ventana valida.
- **Undercut threat:** auto de atras ya paro, delta neto proyectado lo coloca a <=1.5 s despues de la parada del auto de adelante.
- **Overcut candidate:** auto que queda fuera tiene pace limpio >=0.20 s/lap mejor y el recien parado reingresa en trafico.
- Etiquetar siempre “estimacion”; desactivar con flags, datos stale >15 s o confidence low.

### Confidence

- **High:** >=5 muestras limpias, datos <8 s, sin flags/pits en ventana, baja dispersion (MAD <=0.20 s).
- **Medium:** >=3 muestras, datos <15 s, MAD <=0.40 s.
- **Low:** menos datos, inferencia parcial o stale 15–30 s.
- **Unavailable:** stale >30 s o campos esenciales ausentes.

## 13. Explain deterministico y LLM opcional

### Motor por reglas — obligatorio

`InsightEngine` recibe snapshot anterior/actual y produce candidatos desde templates versionados. Ejemplo:

```ts
template('battle.closing', {
  headline: `${behind.code} recorta a ${ahead.code}`,
  evidence: [`Gap ${fmt(gap)}`, `Cierre ${fmtRate(rate)}`, `Muestra ${n} vueltas limpias`],
  required: ['gapSec', 'closingRateSecPerLap'],
});
```

Reglas de seguridad:

- Cada numero del texto debe mapear a un campo de evidence.
- No usar palabras “seguro”, “va a”, “debe parar” o causalidad no observada.
- Mostrar “estimado” y confidence en predicciones.
- Deduplicar por entidad/tipo; cooldown de 30 s salvo cambio material.
- Snapshot de evidencia queda asociado al insight para auditoria.

### LLM — opcional y apagado por defecto

Feature flag `ENABLE_LLM_EXPLAIN=false`. Si se activa, solo puede reescribir el JSON deterministico validado; no recibe acceso libre a internet ni genera nuevos hechos/numeros. Salida con schema `{ headline, body }`, temperatura baja y validacion que verifica que todos los numeros/nombres existan en input. Ante timeout, schema invalido o termino prohibido, usar texto deterministico. Nunca bloquear Race Mode por el LLM.

## 14. Estados de datos y resiliencia UI

- **Loading inicial:** skeleton de header + 10 filas; texto “Connecting to session data”.
- **No live:** countdown y ultima informacion conocida; no spinner infinito.
- **Stale:** banner amarillo “Data delayed · 18s”, conservando vista.
- **Rate limited:** “Provider is limiting updates; showing cached data”.
- **Partial:** cada widget maneja capability/ausencia por separado.
- **Offline:** service worker muestra shell, ultimo snapshot y timestamp; acciones locales funcionan.
- **Fatal:** retry visible, request ID y acceso a replay demo.
- **Empty finished:** resultado provisional pendiente y reintentos desacelerados.

## 15. UX/UI

### Tokens

- Fondo `#0B0D10`, superficie `#15181D`, texto `#F5F7FA`, muted `#9BA3AF`.
- Accent `#FF365F`; green `#3DDC97`; yellow `#FFD166`; red flag `#FF3B30`.
- Tipografia system sans; numeros con `font-variant-numeric: tabular-nums`.
- Tap targets >=44x44 px; radio 12 px; grid base 4 px.
- El color nunca es el unico indicador.

### Wireframe mobile — Race

```text
┌─────────────────────────────┐
│ AUSTRIAN GP     LAP 43 / 71 │
│ ● GREEN      LIVE · 4s      │
├─────────────────────────────┤
│ ★ COL P12  M · 17           │
│ +1.2 ALO | +0.8 GAS | ↗     │
├─────────────────────────────┤
│ WHAT MATTERS NOW        [3] │
│ PIA closing on LEC · MED    │
├─────────────────────────────┤
│ 1 NOR       M12       —     │
│ 2 VER       M14     +2.1    │
│ 3 PIA       H08     +5.7    │
│ 4 RUS       H09     +1.3    │
│ 5 LEC       M21     +0.8    │
│ ...                         │
├─────────────────────────────┤
│ Live  Battles  Track  ★Fav  │
└─────────────────────────────┘
```

### Battle sheet

```text
┌─────────────────────────────┐
│ BATTLE · P3 / P4            │
│ PIA → LEC                   │
│ Gap 1.4s · closes 0.18/lap  │
│ DRS in ~2–4 laps · MEDIUM   │
│ Evidence: last 4 clean laps │
│ [Compare drivers]           │
└─────────────────────────────┘
```

### Qualifying

```text
┌─────────────────────────────┐
│ QUALIFYING · Q2       02:41 │
│  8 HAM +.481                │
│  9 ANT +.522                │
│ 10 ALO +.601  ── CUTOFF ── │
│ 11 COL +.633  NEEDS ~.032   │
│ ON TRACK: S1 ✓ S2 ✓ S3 ... │
└─────────────────────────────┘
```

### Responsive

- 320–767 px: una columna, bottom navigation, sheets.
- 768–1199 px: leaderboard + panel lateral de battles.
- >=1200 px: max-width 1280, tres zonas (leaderboard, context, race control); no agregar funcionalidad exclusiva.

### Accesibilidad

- WCAG 2.2 AA; contraste verificado.
- Semantica de tabla/lista apropiada y headers anunciables.
- `aria-live=polite` solo para race status prioritario, con throttling para evitar ruido.
- Navegacion completa por teclado, focus visible, escape cierra sheets.
- `prefers-reduced-motion`; no animar reordenamiento si esta activo.
- Etiquetas textuales para compuestos, flags y tendencias.

## 16. Preferencias locales

Versionar `localStorage` bajo `f1c:prefs:v1`:

```ts
interface Preferences {
  favoriteDriverId: string | null;
  syncDelaySeconds: 0 | 10 | 20 | 30 | 45 | 60;
  timezone: 'local' | 'circuit';
  units: 'metric';
  reducedData: boolean;
  dismissedOnboarding: boolean;
}
```

Validar/migrar con Zod; valores corruptos vuelven a defaults. No guardar identificadores de analytics ni snapshots sensibles en localStorage.

## 17. Analytics minimos

Proveedor privacy-friendly opcional. Eventos sin nombres libres ni datos personales:

- `app_opened`, `session_view_started`, `mode_viewed`
- `favorite_driver_selected`
- `battle_opened`, `driver_detail_opened`, `driver_compare_opened`
- `explain_opened`, `sync_delay_changed`
- `data_state_changed` (`fresh/stale/offline/rate_limited`)
- `replay_started`

Feature flag `ENABLE_ANALYTICS=false`; respetar Do Not Track. Nunca enviar lap data completa.

## 18. Estructura del repositorio

```text
f1-companion/
├─ apps/web/
│  ├─ app/(app)/weekend/page.tsx
│  ├─ app/(app)/drivers/[driverId]/page.tsx
│  ├─ app/(app)/compare/page.tsx
│  ├─ app/(app)/track/page.tsx
│  ├─ app/(app)/settings/page.tsx
│  ├─ app/api/v1/...
│  ├─ components/{race,qualifying,practice,shared}/
│  ├─ lib/client/
│  ├─ public/{icons,tracks}/
│  └─ tests/e2e/
├─ packages/domain/src/{models,session-machine,metrics,insights}/
├─ packages/providers/src/{types,openf1,replay,season-catalog,normalizers}/
├─ packages/ui/src/
├─ fixtures/{manifest.json,season-2026.json,2026-hungary-race.json,2026-hungary-race.ndjson}
├─ .env.example
├─ pnpm-workspace.yaml
├─ README.md
└─ package.json
```

## 19. Variables de entorno

```dotenv
DATA_PROVIDER=openf1
OPENF1_BASE_URL=https://api.openf1.org/v1
OPENF1_API_KEY=
CACHE_BACKEND=memory
KV_REST_API_URL=
KV_REST_API_TOKEN=
ENABLE_REPLAY=true
REPLAY_DEFAULT_SESSION=demo-race-2024
ENABLE_LLM_EXPLAIN=false
OPENAI_API_KEY=
ENABLE_ANALYTICS=false
NEXT_PUBLIC_ANALYTICS_HOST=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Solo variables `NEXT_PUBLIC_*` llegan al browser. Arrancar sin keys en replay mode.

## 20. Replay/mock mode

El ReplayAdapter lee un snapshot inicial y eventos NDJSON `{ atMs, type, payload }`. Controles: play/pause, 1x/4x/16x, seek y reset. El reloj es inyectable (`Clock` interface), por lo que heuristicas y UI no dependen de `Date.now()` directamente.

### Fixture JSON minimo de ejemplo

```json
{
  "schemaVersion": 1,
  "session": {
    "id": "session:replay:demo-race-2024",
    "meetingId": "meeting:replay:demo-2024",
    "kind": "race",
    "phase": "live",
    "startedAt": "2024-06-30T13:00:00Z",
    "endsAt": null,
    "clockSeconds": null,
    "lap": 43,
    "totalLaps": 71,
    "trackStatus": { "code": "GREEN", "label": "Green flag" },
    "drivers": [
      {
        "driverId": "driver:4:2024",
        "number": 4,
        "code": "NOR",
        "fullName": "Lando Norris",
        "teamName": "McLaren",
        "teamColor": "#FF8700",
        "position": 1,
        "status": "running",
        "gapToLeaderSec": 0,
        "intervalAheadSec": null,
        "lastLapSec": 68.921,
        "bestLapSec": 67.843,
        "pace3Sec": 68.88,
        "pace5Sec": 68.91,
        "currentStint": { "index": 2, "compound": "MEDIUM", "startLap": 32, "endLap": null, "tyreAgeAtStart": 0, "currentAgeLaps": 12 },
        "stints": [],
        "laps": []
      },
      {
        "driverId": "driver:1:2024",
        "number": 1,
        "code": "VER",
        "fullName": "Max Verstappen",
        "teamName": "Red Bull Racing",
        "teamColor": "#3671C6",
        "position": 2,
        "status": "running",
        "gapToLeaderSec": 2.1,
        "intervalAheadSec": 2.1,
        "lastLapSec": 68.99,
        "bestLapSec": 67.91,
        "pace3Sec": 68.95,
        "pace5Sec": 68.97,
        "currentStint": { "index": 2, "compound": "MEDIUM", "startLap": 30, "endLap": null, "tyreAgeAtStart": 0, "currentAgeLaps": 14 },
        "stints": [],
        "laps": []
      }
    ],
    "raceControl": [],
    "battles": [],
    "insights": [],
    "meta": {
      "provider": "replay",
      "sourceUpdatedAt": "2024-06-30T14:02:10Z",
      "ingestedAt": "2024-06-30T14:02:11Z",
      "stale": false,
      "ageSeconds": 1
    }
  }
}
```

El repositorio debe incluir un fixture mas completo con al menos 8 pilotos, 12 vueltas por piloto, dos pits, un VSC, un mensaje de race control y una batalla que entra en DRS.

## 21. Testing

### Unit

- Normalizadores por provider con payloads faltantes/malformados.
- Clean lap filtering y pace 3/5.
- Closing rate, catch, DRS, tyre age, pit/rejoin y confidence.
- Session state transitions y prohibicion de regresiones invalidas.
- Insight templates: todo numero debe estar en evidence.

### Integration

- Adapter -> normalizer -> engine -> endpoint snapshot.
- Polling coalescido, cache stale y 429/Retry-After.
- SSE reconnect, delay consistente y fallback polling.
- Replay determinista con fake clock.

### Component/accessibility

- Race leaderboard, Favorite strip, Battle card, Explain sheet y banners.
- axe sin violaciones criticas; teclado/focus y reduced motion.

### E2E Playwright

1. Abrir app sin provider key y cargar replay.
2. Elegir favorito y verificar persistencia tras reload.
3. Avanzar replay hasta batalla; abrir compare.
4. Inyectar VSC; verificar banner, Explain y pit projections deshabilitadas.
5. Simular offline/stale; conservar snapshot y timestamp.
6. Completar replay; mostrar resultado provisional y proxima carrera.

## 22. Seguridad, privacidad y performance

- Validar params y respuestas; timeouts upstream de 8 s.
- Rate limiting propio por IP en endpoints costosos, sin almacenar IP cruda en analytics.
- Headers CSP, HSTS en produccion, `nosniff`, referrer policy estricta.
- No renderizar HTML del provider; race control como texto escapado.
- Lighthouse mobile objetivo: Performance >=85, Accessibility >=95, Best Practices >=95, PWA instalable.
- JS inicial objetivo <220 KB gzip excluyendo framework; lazy-load charts y compare.
- LCP <2.5 s en 4G simulado con snapshot cacheado.

## 23. Criterios de aceptacion

### Producto

- La home solo muestra GP actual/proximo, sus sesiones y una unica proxima carrera.
- El modo cambia correctamente entre pre, practice, qualifying, race y post-race.
- Race Mode muestra 20 pilotos cuando existen, favorito, gaps, tyres, stints, pace, battles, race control y Explain.
- No existe ninguna ruta/seccion de noticias o calendario anual.
- Detalle y compare funcionan con datos parciales.

### Datos

- La app arranca sin credenciales usando replay.
- Cambiar `DATA_PROVIDER` no exige cambios en UI/dominio.
- Datos stale/offline/rate-limited son visibles y no producen numeros falsos.
- Toda prediccion incluye confidence; toda cifra de Explain tiene evidencia.
- Delay se aplica consistentemente a toda la vista.

### Calidad

- Unit/integration/component/E2E pasan en CI.
- TypeScript strict, lint y build sin errores.
- PWA instalable, shell offline y ultimo snapshot legible.
- Layout usable a 320 px, 768 px y 1280 px.
- No hay secretos en bundle ni logs.

## 24. Definition of Done

- Implementacion desplegada con URL preview/production.
- README contiene setup, arquitectura, provider limitations y replay instructions.
- `.env.example` completo; arranque replay con un solo comando despues de instalar.
- Fixture completo versionado y determinista.
- Pruebas y Lighthouse ejecutados; desviaciones documentadas.
- Error/loading/no-live/stale/offline/post-race verificados.
- Smoke test contra al menos una sesion historica real del adapter live.
- Si hay sesion live disponible, smoke test sin modificar datos; si no, replay cubre el mismo flujo.
- No quedan TODOs que bloqueen el camino critico.

## 25. Run y deploy

```bash
corepack enable
pnpm install
copy .env.example .env.local
pnpm dev
```

Abrir `http://localhost:3000`; replay debe estar seleccionado por defecto si no hay credenciales.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Para deploy, configurar las mismas variables en Vercel o plataforma compatible, mantener `OPENF1_API_KEY`/`OPENAI_API_KEY` solo en servidor y seleccionar cache KV cuando haya multiples instancias. Ejecutar migraciones solo si se agrega persistencia; el MVP no necesita base de datos.

## 26. Riesgos y decisiones explicitas

- **Cobertura/frescura del provider:** resolver con capabilities, cache, estados visibles y replay.
- **Rate limits:** coalescing server-side y polling adaptativo; no permitir polling directo por cliente al upstream.
- **Pit-loss incierto:** campo configurable por circuito, fallback etiquetado y confidence.
- **Orden fisico vs clasificacion:** solo detectar battles con orden confiable; no mezclar lapped cars.
- **Reglas cambiantes:** cutoff, DRS y formatos de sprint son config por temporada/sesion.
- **Costo:** LLM, analytics y KV apagados por defecto; core funcional gratis.

---

## 27. Codex execution instructions

Implementa este PRD de principio a fin sin pedir confirmaciones. Ante una ambiguedad, elige la opcion mas simple que preserve tipos, adapter boundaries y funcionamiento end-to-end. Prioriza una experiencia demostrable sobre amplitud visual.

### Orden obligatorio

1. Inicializa monorepo pnpm, Next.js, TypeScript strict, lint, Tailwind y test runners.
2. Crea modelos Zod/TypeScript, `Clock`, config heuristica y maquina de estados en `packages/domain`.
3. Implementa y prueba funciones puras: clean laps, pace, battles, closing/catch, DRS, tyre age, pit/rejoin y confidence.
4. Define `TimingProvider`; implementa primero `ReplayAdapter` y fixture completo. Haz que un replay de carrera complete el flujo antes de integrar red.
5. Implementa normalizacion, Session Engine, InsightEngine deterministico, cache/request coalescing y endpoints REST/SSE.
6. Construye el shell PWA y estados loading/no-live/stale/offline/error.
7. Construye Race Mode en este orden: header/status, leaderboard, Favorite strip, Battles, Explain, Race Control, tyres/stints y pit projection.
8. Agrega Driver detail/compare y Track.
9. Agrega Practice, Qualifying, Pre-weekend y Post-race reutilizando componentes del dominio.
10. Implementa preferencias locales, sync delay y responsive/a11y.
11. Implementa `OpenF1Adapter` (o adapter live elegido) con capabilities y payload fixtures grabados; nunca acoples sus campos a componentes.
12. Agrega unit, integration, component y E2E tests descritos. Corrige hasta que todos pasen.
13. Ejecuta lint, typecheck, tests, build y Lighthouse. Documenta limitaciones reales, no hipoteticas.
14. Despliega una preview si el entorno tiene credenciales; de lo contrario deja build production listo y comandos exactos.

### Reglas de ejecucion

- No implementes nada de la seccion fuera de alcance.
- No agregues database, auth, pagos o LLM al camino critico.
- No uses datos hardcodeados en componentes; todo demo entra por ReplayAdapter.
- No inventes campos faltantes. Usa `null`, capability flags y estados parciales.
- No muestres una proyeccion con confidence low como numero exacto.
- Mantener funciones derivadas puras y cubiertas por tests.
- Si OpenF1 cambia o falla, completa igualmente el MVP replay y aisla el error en el adapter.
- No dejes pantallas placeholder en rutas incluidas en alcance.
- El resultado final debe arrancar en replay con fixture incluido, poder cambiar a provider live por entorno y recorrer una carrera completa hasta post-race.

### Resultado esperado de Codex

Al finalizar, reporta: archivos principales, decisiones tomadas, comandos ejecutados y resultados, URL si se desplego, limitaciones del proveedor verificadas y pasos exactos para probar replay y una sesion real. No declares completado hasta que `pnpm build` y el E2E del replay pasen.
