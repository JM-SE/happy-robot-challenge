# Phase 4 — Operations UI Implementation Index Specification

**Status:** **PLAN READY — NORMATIVE INDEX; NOT IMPLEMENTED**

## Context

Phase 4 añade una superficie de Operations estrictamente read-only sobre el adaptador existente: dashboard en `/operations`, detalle en `/operations/calls/[callId]` y una API autenticada para ingesta, listado, detalle y resumen. No reemplaza ni extiende el protocolo TMS, las rutas TMS ni los gates de real-booking de Phase 3.

El handoff requiere una proyección local explícita porque Twin no está disponible. La implementación usa un store in-memory, process-scoped y no persistente, sin DB ni dependencia de Twin. `ADAPTER_UI_DATA_MODE=fixture` se conecta en 4B: si vale `fixture`, siembra fixtures deterministas y acepta después ingesta sanitizada; unset/empty puede iniciar vacío; cualquier otro valor falla cerrado. `OperationsMode` es únicamente `demo | real-read-only`; **Demo/Mock** es un label de UI para `demo`, `adapter-fallback` es sólo metadata `meta.source` del envelope, y `source` de record es sólo `fixture | ingested`. OTP delivery no está disponible y no se implementará.

El dashboard no ofrece acciones de booking, edición, borrado, replay, retry ni ninguna otra mutación de dominio. La única escritura permitida en esta fase es la ingesta autenticada de un raw handoff payload, sanitizado por 4A antes de persistir mediante `POST /api/operations/calls`; no es una mutación TMS ni una autorización de operación.

El repositorio usa Next.js 16 App Router, React 19, TypeScript strict y Vitest. `app/layout.tsx` y `app/page.tsx` son mínimos, no existe una component library/CSS library que deba ampliarse, y el trabajo debe reutilizar los estilos/primitivas disponibles sin añadir librerías innecesarias.

## Dependencies / Inputs

- [ ] Completar el **Preflight Audit** obligatorio de este índice antes de tocar Phase 4A.
- [ ] [`phase-3-index.spec.md`](./phase-3-index.spec.md) y las specs 3A/3B/3C/3D son contratos previos: conservar envelopes, request IDs, auth, límites, mappers, configuración server-only y guards.
- [ ] Reutilizar `handleAdapterRequest` y los contratos de `src/tms/http-auth.ts` y `src/tms/http-contract.ts` cuando sean compatibles; no duplicar auth, envelopes ni status mapping.
- [ ] Reutilizar `src/tms/adapter-config.ts` solo para la frontera server-only existente. La configuración de UI no puede habilitar TMS real ni booking.
- [ ] Confirmar el estado mínimo de `app/layout.tsx`, `app/page.tsx`, estilos, scripts, tests y build antes de elegir componentes UI.
- [ ] Mantener `ADAPTER_UI_DATA_MODE` como selección server-only del data source; `fixture` es el único valor no vacío válido, cualquier valor inválido falla cerrado y nunca se selecciona desde cliente, query, header o body.
- [ ] No usar DB, Twin, OTP provider, credenciales, targets reales, TMS real ni `LOAD_BOOK`.
- [ ] Los cinco specs de Phase 4 deben fijarse primero en un único commit documental de planificación. Ese commit contiene los cinco specs, no modifica product code, no cuenta como fase ni como commit intermedio de implementación y queda fuera de la corrida autónoma.

## Autonomous Execution and Branch Policy

Phase 4 se ejecuta como una sola corrida autónoma de `@coder-heavy`, en el orden estricto **4A → 4B → 4C → 4D**. Antes del handoff, los cinco specs deben quedar fijados en un único commit documental de planificación. El baseline limpio de la rama dedicada debe incluir previamente ese commit, o ese commit debe ser el commit base inmediatamente anterior a la creación de la rama. El commit documental es un prerrequisito histórico, no pertenece a la corrida, no cuenta como fase ni como commit intermedio de implementación. El planner completa el preflight y realiza un único handoff inicial; no solicita ni espera aprobación humana entre fases. `@coder-heavy` debe crear o recibir una única rama dedicada para toda Phase 4, recomendada `feature/operations-phase-4`, aunque puede usar otro nombre si lo documenta en el reporte. No se crean ramas por fase y la rama no puede incluir cambios no relacionados.

Cada fase conserva su allowlist y responsabilidades. Al terminar una fase, `@coder-heavy` ejecuta el gate técnico completo, crea el commit separado de esa fase sólo si el gate pasa y continúa automáticamente con la siguiente spec. Un gate **PASS** y el hash del commit de esa fase, observado dentro de la misma corrida, son la única condición de avance; no se permite saltar ni reordenar fases. Una corrida normal y exitosa produce exactamente cuatro commits de implementación: uno para 4A, uno para 4B, uno para 4C y uno para 4D. Esos cuatro commits no se squashan, combinan ni mezclan con el commit documental. Durante la corrida no se crean commits adicionales ni se hace squash/merge; únicamente una corrección bloqueante puede generar un commit adicional explícitamente documentado y atribuido a la fase afectada, pero la preferencia normativa es detenerse sin commit si la fase falla.

## Preflight Audit Obligatorio

El planner debe exigir un reporte de auditoría antes de 4A y entregarlo en el único handoff inicial. El reporte debe ser sólo evidencia sanitizada, sin secretos, credenciales, targets, payloads ni datos operativos.

1. Registrar por separado el hash del commit documental/spec baseline, el baseline de la rama, la rama, el diff inicial y los archivos permitidos; confirmar working tree limpio y marcar como inmutables TCP, `src/tms/**` no requerido, rutas `/api/tms/**`, `src/tms/policy.ts`, `src/tms/real/**`, `src/tms/controlled-booking.ts`, ledger, authority, transport y cualquier real-booking gate.
2. Auditar `app/layout.tsx`, `app/page.tsx`, estructura App Router, estilos disponibles, configuración TypeScript/Vitest, scripts de `typecheck`, `lint`, `test` y `build`, y el grafo de imports que no debe alcanzar TMS/TCP desde Operations.
3. Revisar `src/tms/http-auth.ts`, `src/tms/http-contract.ts` y `src/tms/adapter-config.ts` para decidir si existe auth/session reutilizable. Si no existe una sesión reutilizable, seleccionar la alternativa de secreto UI server-only, login y cookie HTTP-only segura descrita en 4B.
4. Confirmar que Twin/DB no es una dependencia local; documentar sólo la limitación sanitizada de Twin unavailable/quota y la proyección local de fixtures, sin propagar el detalle crudo de la cuota a UI, API, logs o reportes.
5. Confirmar que OTP delivery es una dependencia no disponible y queda fuera de la implementación; no crear provider, simulación de entrega ni endpoint OTP.
6. Fijar el allowlist de campos de Operations antes de 4A. El raw body de `POST /api/operations/calls` acepta exactamente las claves del handoff: `callId` (opcional), `occurredAt`, `mcNumber`, `loadId?: string | null`, `agreedRate?: number | null`, `fmcsaverified`, `otpVerified`, `bookingSuccessful`, `bookingRef`, `outcome`, `handoffReason`, `notes`, `mode`, `technicalStatus`, más únicamente `origin`, `destination`, `equipment` y `publishedRate` como enriquecimiento seguro opcional. Ausencia y `null` de `loadId` significan no match; ausencia y `null` de `agreedRate` significan sin agreed rate; no se inventa ningún dato. No exige `fmcsaStatus`, `otpStatus`, `bookingStatus` ni `matchedLoads` en el raw input.
7. Verificar que unknown/forbidden fields se descartan silenciosamente antes de persistir, sin reflejar clave/valor en error, log o response; valores malformados de campos aprobados producen errores seguros; fixtures, ingesta, store, responses, logs, errores, ejemplos y documentación excluyen raw logs, secretos, `MAX_BUY`, `max_rate`, cualquier MC completo, raw transcript, raw TCP, full notes y datos equivalentes.
8. Emitir `READY` o `BLOCKED`. Un campo sensible sin política de descarte, auth no resoluble, dependencia de DB/Twin, o cualquier ruta de real-booking alcanza para `BLOCKED` y detiene 4A.

## Phase Map

| Phase | Objective | Scope | Non-goals | Dependencies | Exit signal | Primary risk |
| --- | --- | --- | --- | --- | --- | --- |
| **4A — Foundation** | Crear el modelo canónico seguro, sanitizer, store, resumen y fixtures. | Tipos cerrados, `unknown raw ingestion payload -> canonical CallRecord`, descarte silencioso, factory in-memory y composición futura. | APIs, auth, `ADAPTER_UI_DATA_MODE`, UI, DB/Twin, OTP, TMS real, `LOAD_BOOK`, mutaciones. | Preflight y Phase 3 contracts/config. | Tests puros prueban determinismo, aislamiento, derivación y ausencia de campos prohibidos. | Persistir o devolver datos sensibles, o crear un singleton no testeable. |
| **4B — API + auth** | Exponer contratos autenticados de Operations sin bypass de Phase 3. | POST raw del handoff; GET list/detail/summary; wiring de `ADAPTER_UI_DATA_MODE`; envelopes, IDs, límites y auth separada. | UI nueva, edición/borrado/booking, DB/Twin, OTP, TMS/TCP, auth en cliente. | 4A con gate automático PASS y hash de su commit de fase en la misma corrida, más decisión de auth del preflight. | Contract/security tests prueban auth, descarte, `409 DUPLICATE_CALL_ID`, zero TMS reachability y errores seguros. | Auth duplicada, cookie insegura o POST convertido en mutación arbitraria. |
| **4C — UI** | Entregar dashboard y detalle read-only consumiendo sólo GET autenticados. | Rutas `/operations` y `/operations/calls/[callId]`, modelos canónicos, componentes enfocados, estados y CSS local. | Cualquier control de mutación, transcript/log viewer, booking, OTP, nueva librería o rediseño global. | 4B con gate automático PASS y hash de su commit de fase en la misma corrida, fixtures y estilos auditados. | Smoke/component tests y revisión manual prueban navegación read-only y ausencia de controles engañosos. | Página monolítica, fetch client-side inseguro o UI que parezca autorizar operaciones. |
| **4D — Tests/docs/release** | Cerrar regresiones, seguridad, documentación y release de demo/read-only. | Suite focalizada + completa, diff/security review, README sanitizado, reporte de commits y checklist de release. | Deploy real, Twin/DB, OTP, credenciales, targets, real TMS o `LOAD_BOOK`. | 4A–4C cerradas con gates automáticos PASS y sus hashes de fase de la misma corrida. | Todos los gates pasan; cuarto commit separado con hash y reporte; revisión final del planner/reviewer sólo después de 4D, si aplica. | Tests verdes insuficientes, docs que implican readiness real o mezcla de fases. |

## Files / Modules

Los nombres pueden ajustarse durante la implementación, pero las responsabilidades y fronteras son normativas:

- [ ] **4A:** `src/operations/contracts.ts`, `src/operations/sanitize.ts`, `src/operations/fixtures.ts`, `src/operations/store.ts`, `src/operations/summary.ts`, `tests/operations/contracts.test.ts`, `tests/operations/sanitize.test.ts`, `tests/operations/fixtures.test.ts`, `tests/operations/store.test.ts` y `tests/operations/summary.test.ts`; sólo foundation, sin `process.env`.
- [ ] **4B:** `src/operations/config.ts`, `src/operations/api-contract.ts`, `src/operations/operations-auth.ts`, `src/operations/session-helper.ts`, `src/operations/operations-dto.ts`, `src/operations/response-mapper.ts`; `app/api/operations/calls/route.ts`, `app/api/operations/calls/[callId]/route.ts`, `app/api/operations/summary/route.ts`, login/logout si hacen falta, y tests `tests/operations/api/**`.
- [ ] **4C:** `app/operations/page.tsx`, `app/operations/calls/[callId]/page.tsx`, `src/operations/ui/**`, `src/operations/client/operations-api.ts`, `src/operations/model/**`, `src/operations/lib/**`, un CSS module local y tests `tests/operations/ui/**`; sólo UI read-only.
- [ ] **4D:** `README.md`, `tests/operations/**` y correcciones focalizadas únicamente en los archivos 4A–4C ya aprobados; no se crea un reporte en el repositorio.
- [ ] Estos son los scopes permitidos por fase; no se modifican `app/layout.tsx`, `app/page.tsx`, `src/tms/**`, `mock/**`, `.env`, configuración no listada ni rutas TMS.

## Module Boundaries / Contracts

- **API:** `POST /api/operations/calls` recibe el raw contract del handoff, lo pasa por `unknown raw ingestion payload -> canonical CallRecord`, y responde sólo `{ok:true,data:{callId,stored:true},meta:{requestId,source:"adapter-fallback"}}`; `GET /api/operations/calls`, `GET /api/operations/calls/[callId]` y `GET /api/operations/summary` devuelven DTOs allowlisted derivados. Todas las rutas usan envelope/request ID y auth correspondiente.
- **API shape:** list/detail usan `mcMasked`, `fmcsaStatus`, `otpStatus`, `bookingStatus`, `bookingSuccessful`, `bookingReference`, `outcome`, `handoffStatus`, `mode` y `technicalStatus`; list nunca contiene `notes` ni `handoffReason`; detail puede incluir sólo `matchedLoads`/load fields, rates, un `handoffReason` safe detail field y `notes` ya sanitizado/canonizado de <=240 caracteres, nunca el original/full/raw note. Summary devuelve los siete count fields `totalCalls`, `fmcsaverified`, `loadsMatched`, `demoBookings`, `failedNegotiations`, `handoffs` y `technicalErrors`, más `fmcsaVerificationRate`; nunca `mcNumber` raw ni lower-case outcome/status aliases. `source: "fixture" | "ingested"` es provenance del record y `meta.source: "adapter-fallback"` es metadata de response separada.
- **Read-only UI:** `/operations` y `/operations/calls/[callId]` sólo consumen GET. La tabla usa `mcMasked`, canonical statuses, load ID, agreed rate, booking reference, outcome, handoff, technical status y mode; el detalle muestra los campos de load/rates, reason/notes seguros y exactamente ocho pasos de timeline. No deben mostrar botones ni formularios de edición, borrado, booking, retry, replay, OTP o mutación.
- **IntegrationHealth:** 4C no crea health API ni endpoint y no ejecuta live checks. El panel recibe por props/config server-safe un conjunto estático y centralizado de capability/limitation items conocidos por el producto: Twin unavailable/quota fallback, OTP delivery unavailable, loadboard/TMS read sólo cuando existe una señal segura ya disponible, y real `LOAD_BOOK` disabled; FMCSA sólo se presenta desde una señal segura registrada. Sin señal se muestra `Unavailable`/`Not configured`; nunca `healthy`/`real` por inferencia.
- **Ingesta:** la única escritura es una ingesta autenticada; acepta los nombres raw del handoff, no `fmcsaStatus`, `otpStatus`, `bookingStatus` ni `matchedLoads`. Unknown/forbidden fields se descartan silenciosamente antes de persistir y no se guarda el request original.
- **Sanitizer:** `unknown raw ingestion payload -> canonical CallRecord`; construye field-by-field, acepta `mcNumber` sólo en esta frontera, deriva statuses/matched loads, omite notes unsafe y nunca refleja clave/valor, raw input o errores internos.
- **Store:** `fixture seed + sanitized ingestion -> process-scoped in-memory state`; conserva exactamente `list`, `get`, `insert`, `summary`, usa factory fresca y devuelve copias seguras. Duplicate `callId` siempre es `DUPLICATE_CALL_ID`, sin upsert, overwrite ni idempotencia implícita.
- **Summary:** `sanitized projection -> deterministic aggregate`; cuenta todo el store filtrado, no la tabla limitada. `fmcsaverified` es `fmcsaStatus=VERIFIED`; denominator es `VERIFIED+UNAVAILABLE+FAILED` excluyendo `NOT_RUN`; rate es ratio/null; `loadsMatched` cuenta calls con match; demoBookings usa la tupla completa; failed negotiations es exact `FAILED_NEGOTIATION`; handoffs y technical errors usan las reglas OR/count-once canónicas. Incluye `fmcsaDenominator` y `fmcsaVerificationRate` en el dominio.
- **Auth:** primero se reutiliza el adapter/session boundary existente sin exponer su secreto. Si no hay sesión reutilizable, el fallback usa secreto UI server-only, login server-side y cookie HTTP-only, `Secure` en producción, `SameSite` restrictivo, `Path` limitado, expiración bounded y sin token en URL/logs. El browser nunca recibe el secreto del adapter/UI.
- **Errors:** status, code, message, retryability y `meta.requestId` son estables y sanitizados; nunca se copia texto de excepciones, Twin, DB, TCP o request payload a una respuesta.
- **Privacy:** ningún response, fixture, store, log, error, screenshot, test report o documento contiene raw logs, secretos (`secret`, `token`, `apiKey`, `authorization`), `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, MC completo/`mcNumber` canónico, raw transcript/raw TCP/frames, request/response bodies, tool calls, full notes ni datos equivalentes.

## Extraction Plan

- [ ] Extraer inmediatamente tipos/allowlists, sanitizer, normalización, summary y constantes bounded; no ponerlos en routes ni pages.
- [ ] Aislar IO y efectos: store factory, bootstrap de fixtures, ingesta y auth/session; los componentes no leen `process.env` ni escriben estado.
- [ ] Separar validación de request, sanitización de datos, mapeo público, status/error mapping y logging seguro.
- [ ] Centralizar en 4B `ADAPTER_UI_DATA_MODE`, nombres de endpoints, límites, estados permitidos, copy de fallback y nombres de cookie; 4A no lee ni cablea ese env.
- [ ] Mantener páginas como contenedores de composición y componentes enfocados para summary cards, call list, call detail, loading, empty, error y auth states.
- [ ] Proveer seams de factory/inyección para que cada test use un store aislado y fixtures deterministas sin un singleton global mutable.

## Modularity Risks

- [ ] No crear una page o route que mezcle auth, validación, sanitización, store, summary, fetch, formato y render.
- [ ] No reutilizar tipos internos TMS ni hacer object spread de payloads de ingesta en DTOs públicos.
- [ ] No introducir una abstracción genérica de mutación: POST sólo ingesta la proyección sanitizada; no existen update/delete/book actions.
- [ ] No importar `client.ts`, parser, transport, TCP, capability, controlled booking, ledger o real runners desde Operations.
- [ ] No convertir el fallback fixture en una fuente de autoridad, idempotencia, evidencia de provider o sustituto de Twin/DB.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] No hay Figma ni Visual Fidelity Contract suministrado; no se debe inventar una referencia visual ni ejecutar una revisión de drift basada en valores no confirmados.
- [ ] La UI sí requiere composición funcional: auditar primero las primitivas/estilos existentes, reutilizarlas y añadir sólo estilos locales mínimos si son imprescindibles.
- [ ] La verificación visual queda limitada a navegación, legibilidad, estados loading/empty/error y ausencia de controles engañosos; no se añade Playwright visual ni una librería UI como dependencia de Phase 4.

## Technical Approach

Construir una cadena server-first y read-only: configuración server-only → auth → bounded JSON/route contract → sanitizer `unknown raw ingestion payload -> canonical CallRecord` → store in-memory fixture + ingestion → safe mapper/summary → envelope con request ID → páginas Operations autenticadas. El POST de ingesta no llega a TMS ni cambia una carga; el dashboard jamás llama POST.

La fuente se inicializa en 4B: `fixture` siembra fixtures seguros y deterministas y luego acepta ingesta sanitizada; unset/empty puede iniciar vacío; un modo inválido falla cerrado. La ingesta se sanitiza antes de persistir y sólo se conserva la proyección aprobada. No se intenta DB, Twin, OTP ni TMS. El fallback nunca oculta un error de seguridad ni cambia silenciosamente a `real-read-only`.

## Phase Details

### 4A — Foundation: tipos, sanitización, store, summary y fixtures

- **Objetivo:** establecer el modelo canónico, la sanitización y una base in-memory segura, reproducible y testeable sin dependencia externa.
- **Alcance:** preflight final; contratos cerrados; `unknown raw ingestion payload -> canonical CallRecord`; descarte silencioso; factory in-memory process-scoped; summary puro; límites y fixtures deterministas. No se cablea `ADAPTER_UI_DATA_MODE` aquí.
- **No-goals:** routes, login/UI, DB/Twin/OTP, TMS/TCP, real mode, `LOAD_BOOK`, booking, update/delete, retry, raw-data retention o logs de payload.
- **Dependencias:** Phase 3A–3D, `adapter-config.ts`, preflight `READY`, TypeScript strict y Vitest.
- **Entregables:** módulos 4A, reporte de clasificación de datos, fixture repeatability tests, sanitizer leakage tests, store isolation/concurrency tests y summary tests.
- **Módulos esperados:** `src/operations/contracts.ts`, `sanitize.ts`, `fixtures.ts`, `store.ts`, `summary.ts` y los cinco tests de foundation enumerados arriba.
- **Exit signal:** dos instancias frescas producen el mismo fixture/summary; ingesta sólo deja la proyección permitida; ningún campo prohibido aparece en memoria, resultados o errores; no existe import TMS/TCP; gates obligatorios pasan.
- **Riesgos:** allowlist incompleto, fixture no determinista, contaminación entre tests, límites ausentes o fallback que retiene el payload original.

### 4B — API + auth

- **Objetivo:** entregar endpoints autenticados y estables sin crear una frontera paralela insegura.
- **Alcance:** POST con el raw contract exacto del handoff; GET de calls, detalle y summary; wiring de `ADAPTER_UI_DATA_MODE`; integración con `handleAdapterRequest`, envelopes, request IDs, límites, métodos/content types y errores; auth separada de adapter/UI con login/cookie segura si hace falta.
- **No-goals:** UI, controles de mutación, DB/Twin, OTP, TMS/TCP, real mode, `LOAD_BOOK`, auth por query/body, secreto en browser o raw error propagation.
- **Dependencias:** 4A cerrada, preflight de auth, `http-auth.ts`/`http-contract.ts` y configuración server-only.
- **Entregables:** routes del API, guard/auth/session si aplica, contratos de status/error, tests de auth/route/leakage/reachability y documentación del endpoint sin datos sensibles.
- **Módulos esperados:** los archivos exactos 4B de `## Files / Modules`, las routes `app/api/operations/**` y `tests/operations/api/**`.
- **Exit signal:** auth inválida no alcanza store ni sanitizer; auth válida obtiene sólo DTOs allowlisted; POST no conserva raw input; GET es read-only; request IDs/envelopes son consistentes; gates obligatorios pasan.
- **Riesgos:** duplicar comparación de secretos, cookie sin flags, auth bypass por GET, endpoint de ingesta usado como mutation API o import accidental de TMS.

### 4C — UI read-only

- **Objetivo:** entregar las dos pantallas de Operations como una vista read-only segura y no mutante.
- **Alcance:** `/operations` con summary/lista; `/operations/calls/[callId]` con detalle; fetch sólo GET autenticado; navegación, loading/empty/error/not-found/auth states; composición enfocada y estilos existentes reutilizados.
- **No-goals:** POST desde UI, edición, borrado, booking, retry/replay, OTP, transcript viewer, raw log viewer, MC/notes completos, nueva component library o rediseño global.
- **Dependencias:** 4B estable, DTOs 4A, auth/session disponible y resultado del style audit.
- **Entregables:** pages, componentes presentacionales, helper de lectura, estados seguros, smoke/component tests y validación manual de read-only.
- **Módulos esperados:** los archivos exactos 4C de `## Files / Modules`, helper GET y `tests/operations/ui/**`.
- **Exit signal:** ambas rutas requieren auth, muestran sólo datos sanitizados, navegan entre lista/detalle, representan fallback fixture sin revelar causa cruda y no ofrecen acciones de mutación; gates obligatorios pasan.
- **Riesgos:** page god component, secretos en bundle, client fetch sin guard, copy que parezca booking confirmado o exposición accidental de datos descartados.

### 4D — Tests, docs y release

- **Objetivo:** cerrar la evidencia técnica y dejar un release demo reproducible sin afirmar readiness real.
- **Alcance:** suite Operations y regresiones existentes; typecheck/lint/build/diff; revisión de seguridad/imports/datos; README con rutas, modo fixture, auth, mapeo AI Extract, fallback y no-goals; reporte de release con archivos, checks y hash real.
- **No-goals:** deployment productivo, credenciales, targets, Twin/DB, OTP, TMS real, `LOAD_BOOK`, health real o nuevas features.
- **Dependencias:** 4A, 4B y 4C con gate automático PASS, sus commits/hashes de fase y reportes de la misma corrida, sin blockers; el commit documental/spec baseline ya existe y no se cuenta como fase.
- **Entregables:** tests finales, docs sanitizadas, checklist de release, security review y reporte de cierre por fase.
- **Módulos esperados:** `README.md`, `tests/operations/**` y correcciones focalizadas sólo en archivos 4A–4C ya aprobados.
- **Exit signal:** matriz completa de gates en verde, diff revisado, ausencia comprobada de real TMS/`LOAD_BOOK`, cuarto commit separado con hash y reporte; la revisión final del planner/reviewer ocurre sólo después de completar 4D, si aplica.
- **Riesgos:** documentación que publique un secreto o claim de producción, test que sólo cubra fixtures felices, o release que mezcle cambios de otra fase.

## Implementation Steps / Workflow Normativo

1. **Commit documental y único handoff inicial:** antes de la corrida, fijar los cinco specs Phase 4 en un único commit documental de planificación y registrar su hash. Ejecutar el Preflight Audit y entregar a `@coder-heavy` la secuencia completa, las allowlists, el reporte `READY` y la instrucción explícita de no ejecutar TMS real, OTP delivery, DB/Twin ni `LOAD_BOOK`. Este commit sólo fija planificación; no es una fase, no es un commit intermedio y el planner no implementa product code.
2. **Baseline y rama:** `@coder-heavy` recibe un baseline/working tree limpio cuyo historial ya incluye el commit documental, o crea la única rama dedicada inmediatamente después de ese commit, recomendada `feature/operations-phase-4`. Debe registrar el hash del commit documental por separado, documentar cualquier otro nombre y verificar que no contiene cambios no relacionados. No se crean ramas por fase.
3. **4A:** implementar sólo 4A; ejecutar focused tests, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, diff-check de scope y security/reachability review. Si todo pasa, crear el commit de implementación separado de 4A, registrar su hash como hash de fase y continuar automáticamente con 4B. Si falla cualquier gate o se detecta leakage/auth bypass/TMS reachability/cambio fuera de scope/requisito no verificable, detenerse sin commit de 4A y sin avanzar.
4. **4B:** implementar sólo 4B y aplicar el mismo gate técnico completo. Con PASS, crear el commit de implementación separado de 4B, registrar su hash como hash de fase y continuar automáticamente con 4C; con FAIL o blocker, detenerse sin commit de 4B y sin avanzar.
5. **4C:** implementar sólo 4C y aplicar el mismo gate técnico completo, incluida la revisión visual/manual definida por su spec. Con PASS, crear el commit de implementación separado de 4C, registrar su hash como hash de fase y continuar automáticamente con 4D; con FAIL o blocker, detenerse sin commit de 4C y sin avanzar.
6. **4D / cierre:** implementar sólo 4D, aplicar el mismo gate técnico completo y crear el cuarto commit de implementación separado únicamente con PASS. No existe una fase posterior. Entregar un reporte consolidado con el hash del commit documental/spec baseline por separado, los cuatro hashes de fase, archivos, comandos/resultados, limitaciones y evidencia de no-real-execution.
7. **Revisión posterior:** no hay revisión ni aprobación humana del planner entre fases. Sólo después de completar 4D y producir su commit/reporte puede realizarse, si aplica, la revisión final del planner/reviewer.
8. **Política de commits:** primero existe el único commit documental de planificación de los cinco specs; después, en la única rama dedicada, la corrida debe producir exactamente cuatro commits de implementación, uno por fase 4A/4B/4C/4D. No hacer squash/merge ni combinar esos commits y no crear commits adicionales durante la corrida. Sólo una corrección bloqueante puede generar un commit adicional explícitamente documentado y atribuido a la fase correspondiente; la preferencia normativa es detenerse sin commit si la fase falla. El commit documental previo es la única excepción previa a la corrida y no cuenta como commit intermedio.

Un **BLOCKER** significa: el circuito técnico automático debe detener la corrida, no crear el commit de la fase fallida, no emitir `PASS` y no avanzar a la siguiente fase. Son blockers cualquier fuga sensible, auth bypass, import TMS/TCP/real-booking, dependencia DB/Twin/OTP, mutación no autorizada, gate fallido, requisito no verificable o cambio fuera de scope. Esta detención no es una intervención humana.

## Verification Plan and Gate Matrix

Toda fase debe pasar los gates siguientes; no hay excepción por ser una fase “sólo UI”. Los comandos son responsabilidad del ejecutor, no del spec writer.

### Pre-run baseline/spec gate

- [ ] Los cinco specs Phase 4 están fijados en un único commit documental de planificación antes de iniciar 4A.
- [ ] El working tree/baseline de la única rama dedicada está limpio e incluye ese commit, o ese commit es su commit base inmediatamente anterior.
- [ ] El hash del commit documental/spec se registra separado de los hashes de fase; no se cuenta como fase ni como commit intermedio de implementación.

| Gate obligatorio | 4A | 4B | 4C | 4D | Regla de avance |
| --- | --- | --- | --- | --- | --- |
| Focused tests + `npm test` | [ ] | [ ] | [ ] | [ ] | Deben cubrir comportamiento y regresión; fallo = BLOCKED. |
| `npm run typecheck` | [ ] | [ ] | [ ] | [ ] | TypeScript strict sin errores. |
| `npm run lint` | [ ] | [ ] | [ ] | [ ] | Sin deuda nueva ni bypasses lintables. |
| `npm run build` | [ ] | [ ] | [ ] | [ ] | App Router y boundaries cliente/server compilables. |
| `git diff --check` | [ ] | [ ] | [ ] | [ ] | Diff limpio y sólo archivos de la fase. |
| Security review | [ ] | [ ] | [ ] | [ ] | Revisar auth, env, cookies, imports, responses, logs, fixtures, bundle y real reachability. |
| Commit de fase separado + hash + reporte | [ ] | [ ] | [ ] | [ ] | Sin gate automático PASS y hash/reporte de la fase de la misma corrida no existe cierre ni se habilita la fase siguiente; el commit documental previo no satisface este gate. |

Además:

- [ ] Unit tests prueban allowlists, descarte de campos prohibidos, determinismo, límites, summary y stores aislados.
- [ ] API tests prueban auth, métodos, content type, body bounded, request IDs, envelopes, GET list/detail/summary, POST sanitizada, not-found y errores seguros.
- [ ] UI tests/smoke prueban auth, navegación, loading/empty/error/fallback, sólo GET y ausencia de botones o llamadas mutantes.
- [ ] Static/import checks prueban que Operations no alcanza TCP, `client.ts`, parser, transport, policy, capability, controlled booking, ledger, real runners o `LOAD_BOOK`.
- [ ] Leakage checks prueban ausencia de raw logs, secretos, `MAX_BUY`, `max_rate`, MC, raw transcript, raw TCP, full MC, original/full/raw notes, stacks y raw provider/Twin/DB errors en todo output verificable; además prueban que list no contiene `notes`/`handoffReason` y que detail sólo puede contener el texto `notes` sanitizado/canonizado <=240 y el `handoffReason` safe detail field.
- [ ] La verificación sólo usa fixtures, store in-memory y seams locales; nunca ejecuta TMS real, OTP delivery, DB/Twin ni `LOAD_BOOK`.

## Rollback Plan

- **Global:** volver al último commit aprobado; conservar todas las `.spec.md`; no reintroducir DB/Twin, fallback real, retry, booking, raw diagnostics ni auth menos restrictiva como reparación.
- **4A:** revertir contratos, sanitizer, store, summary y fixtures; conservar Phase 3 intacta. Si la clasificación de datos es insegura, no guardar raw input y reportar `BLOCKED`.
- **4B:** revertir sólo routes Operations y auth/session nueva; dejar 4A como módulo interno no expuesto. Ante una cookie/auth insegura, cerrar las rutas con denegación segura y rotar el secreto fuera de la aplicación; no añadir auth por query/body.
- **4C:** revertir pages, componentes y estilos locales; conservar API/auth aprobadas si siguen aislables. Ante una fuga en UI/bundle, retirar la pantalla afectada hasta corregirla; no mostrar la fuente raw como diagnóstico.
- **4D:** revertir únicamente docs/tests/release metadata defectuosos; mantener el último baseline funcional y no publicar el release. Un gate fallido impide el commit de cierre y el siguiente handoff.

## Acceptance Criteria

- [ ] Existe un preflight report `READY` que confirma contratos Phase 3, fronteras inmutables, auth elegida, allowlist de datos y ausencia de DB/Twin/OTP/TMS real.
- [ ] Existe previamente un único commit documental que fija los cinco specs Phase 4; su hash está registrado por separado y no se cuenta como fase ni como commit intermedio.
- [ ] Las fases se ejecutan estrictamente 4A → 4B → 4C → 4D en una sola corrida autónoma, con gate automático PASS y exactamente cuatro commits/hashes/reportes de implementación, uno por fase; no existe aprobación manual intermedia y sólo puede haber revisión final después de 4D. No se crean commits adicionales durante la corrida salvo la corrección bloqueante documentada y atribuida permitida por la política.
- [ ] 4B conecta `ADAPTER_UI_DATA_MODE=fixture` para sembrar fixtures deterministas y aceptar después ingesta sanitizada; unset/empty puede iniciar vacío y valores inválidos fallan cerrado, sin DB ni Twin.
- [ ] El raw POST acepta exactamente las claves del handoff, y 4A deriva `fmcsaStatus`, `otpStatus`, `bookingStatus`, `handoffStatus` y `matchedLoads` sin exigirlos al caller.
- [ ] Unknown/forbidden fields se descartan silenciosamente antes de persistir y nunca reflejan clave/valor; los campos aprobados malformados fallan con error seguro. El canonical output es field-by-field y no usa object spread.
- [ ] Sólo la tupla completa `bookingSuccessful === true` + booking reference válido + `outcome === "SUCCESS"` + `mode === "demo"` + `bookingStatus === "BOOKED"` cuenta como booking; `real-read-only` nunca tiene success ni reference.
- [ ] El summary calcula los siete count fields `totalCalls`, `fmcsaverified`, `loadsMatched`, `demoBookings`, `failedNegotiations`, `handoffs` y `technicalErrors`, además de `fmcsaDenominator` en el dominio y `fmcsaVerificationRate` (ratio/null) como campo público adicional; el public summary nunca sustituye `fmcsaverified` por la tasa.
- [ ] MC sólo sale como `MC•••<suffix>` con como máximo tres caracteres visibles y `notes` sólo como sanitized/canonicalized detail text de `MAX_NOTE_LENGTH=240`; list no contiene `notes` ni `handoffReason`, detail sólo permite esos campos seguros, invalid MC se rechaza de forma segura y notes unsafe se omiten.
- [ ] `POST /api/operations/calls`, `GET /api/operations/calls`, `GET /api/operations/calls/[callId]` y `GET /api/operations/summary` están autenticados, bounded, correlacionados y usan envelopes seguros; el POST no es un canal de mutación de dominio.
- [ ] `/operations` y `/operations/calls/[callId]` son read-only, consumen sólo GET y no exponen controles de booking, edición, borrado, retry, replay u OTP.
- [ ] Si no existe auth/session reutilizable, el login usa únicamente un secreto server-only y una cookie HTTP-only segura; ningún secreto llega al cliente, URL, logs, responses o fixtures.
- [ ] Ningún response, UI, fixture, store, log, error, test report o documento contiene raw logs, secretos, `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, MC completo/`mcNumber` canónico, raw transcript/TCP/frames, full notes, request/response bodies, tool calls, stacks o raw provider errors.
- [ ] OTP delivery permanece fuera de scope y no se implementa; real TMS y `LOAD_BOOK` permanecen deshabilitados e inalcanzables.
- [ ] `app/layout.tsx`, `app/page.tsx`, TCP, rutas TMS y real-booking gates no se modifican salvo una dependencia explícita y aprobada por este índice; no se añaden librerías innecesarias.
- [ ] Focused/full tests, typecheck, lint, build, diff-check, scope/security/reachability review pasan en cada fase; cualquier gate fallido, leakage, auth bypass, TMS reachability, cambio fuera de scope o requisito no verificable impide el commit de la fase y el avance automático.
- [ ] La corrida usa una sola rama dedicada desde baseline limpio que ya contiene el commit documental/spec, sin ramas por fase ni cambios no relacionados; ese commit previo se distingue de los cuatro commits de implementación, que permanecen separados y no se squashan/combinen.
- [ ] El reporte final consolidado incluye, sin confundirlos, el hash del commit documental/spec baseline y los cuatro hashes reales de fase 4A, 4B, 4C y 4D, además de archivos, comandos/resultados, limitaciones y evidencia de no-real-execution.
- [ ] La documentación distingue demo fixture/fallback de autoridad, provider evidence, producción, Twin y booking real, y no contiene secretos, credenciales ni targets reales.

## Handoff to `@coder-heavy`

Recibir un baseline/working tree limpio cuyo commit documental/spec anterior ya contiene los cinco specs Phase 4, o crear/recibir la única rama dedicada con ese commit como base inmediata; registrar ese hash aparte. Ejecutar la secuencia completa 4A → 4B → 4C → 4D en una sola corrida autónoma, respetando la allowlist de cada spec, una única rama dedicada y el orden sin saltos/reordenamientos. El planner no implementa product code ni aprueba entre fases. Tras cada gate automático PASS, crear exactamente el commit de implementación de la fase y continuar automáticamente; no crear commits adicionales ni hacer squash/merge durante la corrida salvo la corrección bloqueante documentada y atribuida permitida por la política, con preferencia por detenerse sin commit si falla una fase. Sólo tras 4D puede haber revisión final del planner/reviewer. No tocar TCP, rutas TMS ni real-booking gates; no ejecutar TMS real, OTP delivery, DB/Twin ni `LOAD_BOOK`. Reportar `BLOCKED` inmediatamente ante cualquier fuga, bypass, mutación no autorizada, dependencia externa, requisito no verificable, gate fallido o cambio fuera de scope; no crear el commit fallido ni avanzar. Entregar al final el reporte consolidado distinguiendo el hash documental/spec baseline de los cuatro hashes reales de fase.
