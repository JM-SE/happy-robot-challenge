# Phase 2 — Security Gates Remediation Implementation Specification

**Status:** **PLAN READY — REAL BOOKING BLOCKED UNTIL GATES PASS**

## Context

### Propósito

Este documento es un plan de ejecución para una futura entrega a `@coder-heavy`. Su objetivo es remediar los gates de seguridad, corrección operativa y aceptación del adapter TMS de Phase 2A/2B/2C, de modo que una única operación real `LOAD_BOOK` pueda considerarse únicamente después de una aprobación separada y explícita.

La implementación futura debe mantener dos tracks separados: `mock/local` para regresión y una capacidad real server-only, fail-closed y específicamente aislada. El plan no autoriza ejecutar el runner real, abrir una conexión real, escribir `LOAD_BOOK`, reconciliar una reserva ni modificar evidencia durante esta tarea de planificación.

### No-goals explícitos

Quedan fuera de esta remediation, aunque sus handoff contracts puedan ser dependencias bloqueantes:

- HappyRobot web-call/voice workflow y entrega real de OTP.
- Implementación de integración con FMCSA.
- Negotiation product engine, `Twin`, Apps UI y operación conversacional.
- Docker/cloud deployment, KPIs, QA operacional y submission deliverables.
- Sustituir la autenticación/autorización completa de todos los endpoints del challenge; para Phase 2 se exige que el real booking sea inalcanzable desde rutas públicas. La full endpoint auth permanece como gate futuro del challenge.
- Ejecutar `npm run test:real-tms:booking`, enviar `LOAD_BOOK`, hacer un booking real o modificar cualquier report histórico.

La ausencia de un proveedor confiable de OTP, FMCSA o negotiation, de un durable ledger, de target pinning o de un control de transporte aprobado no se resuelve con un bypass: el resultado correcto es `BLOCKED`.

### Baseline y evidencia

- Phase 1 está cerrada y continúa siendo el baseline local de mock, contracts, parser, limits, cleanup y tests.
- Phase 2A tiene `DEBUG_ECHO` real observado y aceptado condicionalmente (`CONDICIONAL GO / OBSERVED MET`); esa evidencia no demuestra comandos operativos.
- Phase 2B tiene `LOAD_QUERY`/`LOAD_GET` reales observados y aceptados condicionalmente (`CONDICIONAL GO / OBSERVED MET`); la evidencia histórica no equivale a una reconciliación completa de todos los casos zero/multiple/error.
- Phase 2C tiene workflow implementado localmente y checks locales históricamente verdes, pero `LOAD_BOOK` real es `NO-GO`.
- `rollbackAvailable=false` es un hecho operativo: no existe rollback/unbooking automático ni se debe simular uno.
- `reports/tms/phase-2c/real-controlled-booking.json` es evidencia histórica fallida/preflight de un fixture antiguo con `NOT_FOUND`. Debe conservarse exactamente, sin relabel, overwrite, truncado ni interpretación como éxito.
- La redacción de este documento tampoco ejecuta tests, servicios, comandos diagnósticos, runners reales ni operaciones TMS.

### Relación con las specs y la deep review

Esta remediation complementa, no reemplaza, los contratos funcionales de:

- [`phase-2-index.spec.md`](./phase-2-index.spec.md): índice y estado de Phase 2.
- [`phase-2a-real-debug-echo.spec.md`](./phase-2a-real-debug-echo.spec.md): `DEBUG_ECHO` real echo-only.
- [`phase-2b-real-read-only-loads.spec.md`](./phase-2b-real-read-only-loads.spec.md): `LOAD_QUERY`/`LOAD_GET` read-only.
- [`phase-2c-real-controlled-booking.spec.md`](./phase-2c-real-controlled-booking.spec.md): workflow funcional corregido de query → selección → detail → handoffs → one-shot booking.
- [`reviews/phase-2-deep-architectural-security-review.md`](../../reviews/phase-2-deep-architectural-security-review.md): findings F-01 a F-12 que originan los gates de este plan.

La spec 2C sigue siendo la referencia de la secuencia funcional. Este documento añade los controles de seguridad, persistencia, trusted boundaries, clasificación de incertidumbre, evidencia y release necesarios antes de considerar cualquier `LOAD_BOOK` real.

## Dependencies / Inputs

- [ ] `HR-LTMS-PR-001` y la evidencia real ya sanitizada de 2A/2B permanecen como autoridad de protocolo; cualquier divergencia nueva debe clasificarse antes de relajar validaciones.
- [ ] Las specs 2A/2B/2C y la deep review se consultan durante la ejecución; no se crean contracts competidores.
- [ ] El candidate TMS non-production, su identidad, egress y control de transporte deben ser provistos y aprobados fuera de este documento.
- [ ] Un proveedor confiable y verificable de OTP, negotiation y carrier/FMCSA debe existir para una ejecución real; si no existe, Gate 4 queda `BLOCKED`.
- [ ] Un durable atomic ledger con comportamiento crash-safe y multi-worker debe estar disponible; memoria de proceso no es sustituto.
- [ ] Los valores de host, port, token, filters, `LOAD_ID`, MC y rates solo pueden llegar por runtime server-only autorizado; nunca se escriben en esta spec, código, fixtures, logs o reportes.

## Files / Modules

Estos son boundaries de implementación futura. Esta tarea solo crea esta spec y, opcionalmente, actualiza el link de `phase-2-index.spec.md`.

- [ ] `src/tms/config.ts` / `src/tms/config-core.ts` — resolver configuración server-only, activation guard, deadlines y target validado; no exponer secretos.
- [ ] `src/tms/policy.ts` — única policy central de scopes y commands; no entregar real booking capability a routes o `TmsClient` genérico.
- [ ] `src/tms/transport.ts` / `src/tms/client.ts` — TCP/TLS o transporte privado aprobado, una request por conexión, framing, lifecycle y outcomes; sin booking rules, reporting o reconciliation.
- [ ] `src/tms/protocol.ts` / `src/tms/parser.ts` — codec y parser bounded; `rawLine`/diagnostics permanecen privados y no cruzan boundaries públicos.
- [ ] `src/tms/real/target-validation.ts` — allowlist/pinning del candidate, control de egress, TLS o compensating control aprobado.
- [ ] `src/tms/real/capability.ts` — capability real opaca, sellada y solo consumible por el orchestrator de 2C.
- [ ] `src/tms/real/booking-orchestrator.ts` — orquestación del flujo; thin respecto de reglas extraídas, sin parser, handoff implementation ni evidence ad hoc.
- [ ] `src/tms/real/authorization.ts` — state machine, exact identity binding, TTL, final-detail authorization y transition guards.
- [ ] `src/tms/real/attempt-ledger.ts` — port/adaptor de durable atomic one-shot, fencing/idempotency y recovery; si no puede implementarse, devuelve `BLOCKED`.
- [ ] `src/tms/real/handoff-validators.ts` — DTO schemas y validación de trusted OTP, negotiation y carrier/FMCSA proofs; no implementa esos sistemas.
- [ ] `src/tms/real/reconciliation.ts` — única ruta de exact-ID reconciliation y clasificación truthful.
- [ ] `src/tms/real/evidence.ts` — constructive allowlist, provenance, unique append-only writer y redaction; no acepta arbitrary objects.
- [ ] `src/tms/booking.ts` / `src/tms/service.ts` — conservar contratos locales, separar mock booking de cualquier real capability y evitar que un service genérico emita real `LOAD_BOOK`.
- [ ] `src/tms/http.ts` / `src/tms/limits.ts` — límites de body/text/frame, deadlines, rate/concurrency controls y errores seguros.
- [ ] `app/api/tms/**/route.ts` — handlers thin; validan request boundary y delegan, pero no poseen booking business rules ni real capability.
- [ ] `tests/tms/**` y `tests/tms/real/**` — unit, integration, route-denial, security, crash/restart y bounded real-runner tests; los real tests permanecen fuera de `npm test`.
- [ ] `reports/tms/phase-2c/remediation/` — futuros artifacts únicos y sanitizados, separados de `reports/tms/phase-2c/real-controlled-booking.json`; no se crea ni modifica durante esta tarea.

## Module Boundaries / Contracts

### Contratos principales

- `GenericTmsClient` solo puede ejecutar commands permitidos por su scope. En real, nunca puede emitir `LOAD_BOOK`, aunque un caller le pase una policy o capability genérica.
- `RealBookingCapability` debe ser opaca: no se exporta un constructor público, no es serializable, no puede obtenerse desde HTTP, `service.bookLoad`, `TmsClient` genérico, 2A, 2B o `npm test`, y solo la factory/orchestrator server-only puede mantenerla.
- `RealBookingOrchestrator` es el único boundary autorizado para la secuencia 2C. Recibe tipos ya validados y devuelve un `BookingOutcome` cerrado, no un objeto libre.
- `BookingAuthorization` es inmutable y contiene/bindea, en storage privado o mediante digests protegidos, `runId`, `sessionId`, query identity, exact selected `loadId`, carrier proof identity, `agreedRate`, TTL y attempt identity. Es distinto del evidence DTO.
- `AttemptLedger.consumeOnce(key, binding)` realiza un compare-and-set durable y atómico. Una segunda llamada, un worker distinto o un restart devuelve `already-consumed` y no puede escribir booking.
- `TrustedHandoffProvider` es un port de producción para pruebas verificables. `env JSON`, caller assertions y casts desde `unknown` no son proofs. Un fake provider solo puede vivir en tests/local y no puede activar real.
- `WriteDisposition` debe distinguir como mínimo `not-sent`, `sent` y `unknown`; una excepción durante callback, `EOF`, close, malformed response o semantic response después de una posible escritura nunca se degrada a `not-sent`.
- `BookingOutcome` debe distinguir `deterministic-failure`, `success`, `side-effect-uncertain`, `reconciled` y `still-uncertain`, siempre con `rollbackAvailable: false` y sin exponer valores sensibles.
- `ReconciliationClassifier` es la única autoridad para decidir `reconciled` versus `still-uncertain`; un GET exitoso sin documented booking state no basta.
- `SanitizedBookingEvidence` se construye campo por campo desde summaries acotados. No usa `{ ...input }`, no conserva claves desconocidas y no acepta records, raw wire, DTOs completos o configuración.

### Flujo de datos obligatorio

`server-only config → target validation → dedicated capability → current LOAD_QUERY → explicit selection → trusted handoffs → final exact-ID LOAD_GET → immutable authorization → durable consumeOnce → one LOAD_BOOK write → conservative outcome → optional one exact-ID reconciliation → sanitized unique evidence`.

Las routes públicas solo pueden llegar a un denial o a un comportamiento `mock-local` explícitamente seguro; nunca pueden entrar en el flujo real. Los handlers no implementan transiciones, selección, reconciliation ni clasificación.

## Extraction Plan

- Extraer config/target validation, capability isolation, authorization/ledger, handoff validation, reconciliation, evidence y runner antes de ampliar el comportamiento existente.
- Reducir `controlled-booking.ts` a un módulo retirado, façade mínima o eliminado; no permitir que conserve state machine, selection, mapping, byte calculation, handoffs, IO y reporting juntos.
- Mantener parser/transport/client separados de booking business rules; centralizar los diagnostics y prohibir sockets directos en runners o structural diagnostics.
- Mantener `LoadPublic` y mappers separados de `LoadInternal`; `MAX_BUY` continúa optional/internal-only y nunca es input para `AGREED_RATE`.
- Nombrar y centralizar limits, TTL, deadlines, allowed commands, state transitions, outcomes, redaction keys, ledger states y evidence schema version.
- Hacer que las routes sean thin adapters de HTTP: body limits, schema validation, caller boundary futura y llamada a un port; nunca booking rules.

## Modularity Risks

- [ ] **Generic capability bypass:** `RealBookingCapability` + raw `TmsClient` no deben permitir saltar query, selection, detail, handoffs u one-shot.
- [ ] **Public mutation:** `/api/tms/loads/book` no puede obtener real capability. Su comportamiento mock, si se conserva para regresión, debe quedar marcado `mock-local` y no ser presentado como producción segura. Full endpoint auth queda como trabajo futuro del challenge.
- [ ] **Self-attested handoffs:** no aceptar arbitrary env JSON, caller booleans ni runner rebasing como OTP/FMCSA/negotiation proof.
- [ ] **Process-local one-shot:** booleanos en memoria no protegen frente a restart, replay, multi-worker o concurrencia.
- [ ] **Stale/mismatched identity:** nunca sobrescribir supplied `runId`/`sessionId`; mismatch es rechazo, no normalización.
- [ ] **Unclear write outcome:** callback/EOF/malformed/semantic failure post-write debe ir a incertidumbre conservadora, no a retry.
- [ ] **Weak final validation:** el final detail debe ser inmediatamente pre-write y la booking response debe verificar load identity, authorized MC, `AGREED_RATE`, booking reference y timestamp según el documented contract.
- [ ] **Evidence leakage/overwrite:** allowlist positiva, no spread arbitrario, artifacts únicos y preservación del report fallido.
- [ ] **Boundary bypass:** ningún raw socket, `rawLine` o structural diagnostic cruza policy/client/parser/service boundaries.
- [ ] **Resource abuse:** body, text, frame, rate, concurrency, socket y deadline limits deben proteger tanto rutas como runner/local seams.

## Visual Fidelity Plan (no aplica)

- [x] Esta remediation es backend/TCP/security gating; no incluye Figma, UI, maquetación, component layout ni Playwright visual review.

## Technical Approach

### Risk model

Un resultado funcional —por ejemplo, recibir una respuesta que parece indicar booking— no equivale a una operación real segura y correcta. La aceptación operacional requiere probar simultáneamente que:

1. el target era el candidate autorizado y el transporte estaba controlado;
2. la capability solo podía proceder por el workflow correcto;
3. el `loadId`, `runId`, `sessionId`, carrier proof y `agreedRate` eran los autorizados;
4. el attempt budget no podía reutilizarse tras crash, restart o concurrencia;
5. el adapter puede distinguir un `ERR` completo de una respuesta cuya escritura pudo producir side effect; y
6. la evidencia refleja exactamente lo que se sabe, sin false success ni filtración.

`rollbackAvailable=false` aumenta la severidad: una reserva incierta no puede deshacerse automáticamente y un retry puede crear una segunda reserva o negociar con estado remoto ya mutado. Por tanto, la incertidumbre debe conservar el attempt consumido, bloquear retries y escalarse como condición operativa, no convertirse en autorización para probar de nuevo.

### Dependency order

`Gate 0 → Gate 1 → Gate 2 → Gate 3 → Gate 4 → Gate 5 → Gate 6 → Gate 7 → Gate 8`.

Gate 4 depende de proveedores externos confiables y Gate 3 de durable storage; ambas dependencias son bloqueantes. Gate 7 puede preparar límites locales después de Gate 2, pero su aceptación final y la de Gate 8 requieren todos los gates previos. Ningún gate puede declarar real readiness si un predecessor está `BLOCKED`.

### Gate 0 — Preservación, provenance y baseline actual

**Objetivo**

Separar inequívocamente la evidencia histórica de cualquier futura remediation o ejecución, y establecer una baseline reproducible sin real TMS.

**Module/file boundaries**

- Read-only: `reports/tms/phase-2c/real-controlled-booking.json`, reportes históricos 2A/2B y specs existentes.
- Futuros writers: `src/tms/real/evidence.ts` y `reports/tms/phase-2c/remediation/`; nunca el path histórico fijo.
- Futuros runner/tests: `tests/tms/real/booking.test.ts` y helpers separados; ningún baseline local descubre el runner real.

**Contracts/interfaces/data flow**

- `EvidenceProvenance` debe identificar `historical-failed-preflight` frente a `remediation-local` o una futura ejecución autorizada, sin reutilizar ni mutar el artifact histórico.
- Un future evidence writer debe crear artifacts versionados y únicos con create-only semantics; no debe aceptar el nombre del report histórico como destino.
- El baseline produce solo resultados de tooling y tests locales; no recibe secrets, no abre sockets reales y no genera booking evidence.

**Implementation tasks**

1. Marcar el report histórico como input inmutable y documentar que `NOT_FOUND` corresponde al fixture anterior/preflight.
2. Eliminar cualquier writer que use un `REPORT_PATH` fijo o que pueda truncar ese report.
3. Definir `schemaVersion`, provenance y naming único para futuros artifacts de remediation.
4. Ejecutar, en la futura implementación, el baseline local antes y después sin ejecutar ningún real runner.

**Failure behavior**

- Si el artifact histórico no puede distinguirse del nuevo, la ejecución queda `BLOCKED`.
- Si un writer intenta overwrite, relabel o reutilizar el path histórico, debe fallar antes de persistir.
- Un baseline con real network discovery, secrets o real runner no es válido y no puede cerrar este gate.

**Local tests**

- Writer rejects fixed historical path, duplicate artifact name y unknown provenance.
- Regression confirma que `npm test` no descubre `tests/tms/real/**`.
- Test de preservación verifica byte/semantic integrity del report histórico sin editarlo.

**Acceptance criteria**

- [ ] El report histórico sigue fallido/preflight, con `NOT_FOUND`, y no fue relabeled ni overwritten.
- [ ] Existe un destino future-only, unique y append-only para evidence nueva.
- [ ] La baseline local queda separada de cualquier real operation y su provenance es inequívoca.

### Gate 1 — Target, configuration y transport fail-closed

**Objetivo**

Impedir misrouting, fallback accidental, exposición de secretos y consumo indefinido de recursos antes de conceder cualquier capacidad real.

**Module/file boundaries**

- `src/tms/config.ts`, `src/tms/config-core.ts`, `src/tms/real/target-validation.ts`, `src/tms/policy.ts`.
- `src/tms/transport.ts`, `src/tms/client.ts`, `src/tms/limits.ts` y `src/tms/logger.ts`.
- Ninguna route, test, mock o reporter puede duplicar target allowlist o activation policy.

**Contracts/interfaces/data flow**

- `resolveRealTarget(rawConfig): ValidatedRealTarget | BlockedReason` solo acepta la activation triple exacta (`TMS_MODE=real`, `TMS_ENV=non-production`, `TMS_REAL_ENABLED=true`) y valores server-only completos.
- `ValidatedRealTarget` debe representar candidate identity, exact approved endpoint/port, pin/allowlist identity, egress expectation y approved transport mode sin exponer token.
- Un host arbitrario de env no es pinning. El connector solo recibe `ValidatedRealTarget`, nunca raw env.
- Connect timeout, response timeout y end-to-end deadline deben ser positivos, finitos y con upper bounds centralizados. El frame TMS mantiene su byte limit.
- El real path no hace external mock fallback ante config inválida, connection failure, timeout o remote error. `mock-local` solo se selecciona antes, por un scope explícito distinto.

**Implementation tasks**

1. Crear la validación independiente de candidate target: exact allowlist/pinning, approved non-production identity y egress controls.
2. Elegir TLS con server identity verification o documentar y aprobar un private-network compensating control equivalente. Si ninguno existe, no avanzar.
3. Imponer max connect/response/end-to-end timeouts, socket/concurrency ceilings y cleanup bounded.
4. Mantener host, port, token y transport details fuera de errors, logs, reports, fixtures, public responses y browser bundle.
5. Hacer que cualquier config incompleta o contradictoria termine en `BLOCKED`/safe failure antes de `connect` o `write`.

**Failure behavior**

- Target no pinneado, transport no aprobado, timeout sin upper bound, egress desconocido o secret exposure potencial: `BLOCKED`.
- Activación parcial o config inválida: rechazo fail-closed sin socket y sin fallback mock.
- Connect/write/response timeout: terminal según `WriteDisposition`; nunca retry automático.

**Local tests**

- Exact activation flags, missing/partial/whitespace/case-invalid flags y contradictions.
- Target outside allowlist, pin mismatch, wrong environment, invalid port, absent token y unsafe transport.
- Timeout upper-bound, end-to-end deadline, no fallback y no-secret assertions en logs/errors/evidence.
- Connector spy prueba que failure de config ocurre antes de `connect` y `write`.

**Acceptance criteria**

- [ ] Solo un candidate target aprobado y pinneado puede llegar al connector real.
- [ ] TLS verificado o private-network compensating control documentado y aprobado; sin ello el estado sigue `BLOCKED`.
- [ ] Todos los timeouts/deadlines tienen upper bound y el path real no hace fallback, retry ni expone secretos.

### Gate 2 — Capability isolation y eliminación de escape hatches

**Objetivo**

Hacer imposible que un `GenericTmsClient`, `service`, runner, diagnostic o public HTTP route emita real `LOAD_BOOK` fuera del orchestrator 2C.

**Module/file boundaries**

- `src/tms/policy.ts`: scopes centralizados.
- `src/tms/real/capability.ts` y `src/tms/real/booking-orchestrator.ts`: único real booking boundary.
- `src/tms/client.ts` / `src/tms/service.ts`: sin método genérico que autorice real booking.
- `app/api/tms/loads/book/route.ts` y las demás routes: thin denial/local adapters, nunca capability factories.
- `tests/tms/real/load-structural-diagnostic.ts`: debe dejar de abrir sockets directos.

**Contracts/interfaces/data flow**

- `TmsExecutionScope` separa `mock-local`, `real-2a-echo`, `real-2b-read-only` y `real-2c-controlled-booking`.
- `assertAllowed(scope, command)` es central, pero para `LOAD_BOOK` exige además un opaque workflow-owned authorization; command name alone nunca es suficiente.
- `RealBookingCapability` se obtiene solo desde una factory server-only que ya conoce el orchestrator, no desde un constructor reusable ni por dependency injection pública.
- En real, `TmsClient.execute(LOAD_BOOK)` y `service.bookLoad` deben rechazar antes de connect/write. Local mock booking puede conservarse exclusivamente en `mock-local` para regresión y no debe compartir real capability.
- Public `/api/tms/loads/book` devuelve un denial seguro en real y no puede obtener real capability. En `mock-local`, cualquier mutación existente debe quedar expresamente local/test-only; no se presenta como endpoint de producción autenticado.

**Implementation tasks**

1. Retirar la inyección reutilizable de `RealBookingCapability` desde el client genérico.
2. Introducir un port dedicado del orchestrator que acepte solo authorization consumable y handoffs validados.
3. Bloquear `LOAD_BOOK` en public routes, 2A, 2B, normal tests, CI, generic service/client y diagnostics antes de red.
4. Mover business rules fuera de route handlers y conservar solo request parsing, denial/local delegation y response mapping.
5. Mantener explícita la distinción entre safe `mock-local` y real server-only.
6. Registrar como futuro challenge gate la full caller auth de todos los endpoints; no usar la TMS policy como sustituto de HTTP auth.

**Failure behavior**

- Caller sin scope, capability genérica, capability serializada, route pública o client genérico: denial antes de connector/write.
- Un import incidental o diagnostic directo al socket es una regresión P0 y deja el gate `BLOCKED`.
- No convertir un real denial en mock booking silencioso.

**Local tests**

- Capability isolation por type/runtime tests y connector spies.
- Public-route denial en real para `echo`, search, detail y book según el scope; específicamente no debe haber `LOAD_BOOK` write.
- Generic `TmsClient`, `service.bookLoad`, 2A, 2B, CI/default test config y structural diagnostic no pueden emitir real booking.
- Mock local conserva solo los tests explícitos existentes y nunca recibe real target/config.

**Acceptance criteria**

- [ ] No existe un camino genérico desde `TmsClient`/`service`/public route hasta real `LOAD_BOOK`.
- [ ] La única capability real es opaca, server-only, workflow-owned y exige authorization consumable.
- [ ] La ruta pública no obtiene capacidad real; la full endpoint auth continúa identificada como trabajo futuro del challenge.
- [ ] No hay socket directo fuera de transport/client/orchestrator ports aprobados.

### Gate 3 — Authorization inmutable, state machine y durable one-shot

**Objetivo**

Garantizar continuidad de identidad, selección explícita, final detail fresco y un único attempt durable frente a concurrencia, restart y replay.

**Module/file boundaries**

- `src/tms/real/authorization.ts`: estados y legal transitions.
- `src/tms/real/attempt-ledger.ts`: durable atomic storage, leases/fencing/idempotency.
- `src/tms/real/booking-orchestrator.ts`: solo sequencing.
- `src/tms/loads.ts`, `src/tms/booking.ts`: mappers/response contracts, no state machine.

**Contracts/interfaces/data flow**

- Estados obligatorios: `ready → queried → selected → detailed → handoffs-validated → booking-consumed → terminal`, con `uncertain → reconciliation-consumed → terminal` solo después de genuine post-write uncertainty.
- `QueryContext` enlaza query identity, `runId`, `sessionId`, query inputs y freshness deadline.
- `SelectionContext` exige una selección explícita de exactamente un ID retornado por esa query y conserva el ID exacto en memoria; no acepta first-result implicit selection.
- Shortcut de sole result solo puede existir en validation runner si `maxResults=1` y existe una confirmación separada y explícita; aun así se bindea el exact ID.
- `FinalDetail` debe ejecutarse después de handoffs y justo antes de autorización/write. Verifica exact `loadId`, required route/equipment/`RATE`, documented `STATUS` cuando presente, TTL y material drift.
- `AGREED_RATE` es independiente de posted `RATE`; nunca se deriva de `MAX_BUY`, `maxBuy` o `max_rate`, y esos nombres/valores no cruzan evidence/public boundaries.
- `AttemptLedger.consumeOnce` cambia durablemente el attempt de available a consumed antes del write. Ningún outcome restaura el presupuesto; restart/replay/concurrent worker no puede obtener otro write.

**Implementation tasks**

1. Extraer selection y state transitions de `controlled-booking.ts`.
2. Rechazar query sin approved inputs, zero-result sin candidate y multiple-result sin explicit selection.
3. Comparar el final detail contra el exact authorization context sin seleccionar otro load.
4. Implementar atomic ledger real con durable persistence, fencing/lease y crash recovery semantics. Si la plataforma no lo soporta, exponer `BlockedReason: durable-ledger-unavailable` y no usar booleans in-memory.
5. Consumir el attempt inmediatamente antes del write y registrar la disposición sin hacer replay automático.

**Failure behavior**

- Missing/stale context, ID substitution, selection mismatch, final detail drift o TTL vencido: rechazo fail-closed y ningún alternate candidate.
- Ledger unavailable, CAS conflict, lease/fencing failure o recovery ambiguo: `BLOCKED`; nunca fallback process-local.
- Una vez consumido el attempt, todo resultado conserva el consumo, incluso deterministic error, timeout o uncertainty.

**Local tests**

- Zero/multiple results, no implicit selection y sole-result confirmation constraints.
- Exact query/run/session/load binding y rejection de substitution/rebasing.
- TTL expiry, final-detail freshness, material drift, status/identity/rate mismatch.
- Multi-worker concurrency, duplicate calls, crash/restart simulation, ledger CAS/fencing y consumed budget persistence.
- Verificación de que ningún `MAX_BUY`, `maxBuy` o `max_rate` entra en `AGREED_RATE` ni en evidence.

**Acceptance criteria**

- [ ] La secuencia legal y el exact-ID binding son inmutables.
- [ ] No existe first-result implicit selection en production.
- [ ] El final detail ocurre inmediatamente antes del write y valida identity/drift.
- [ ] El durable ledger prueba one-shot atómico entre concurrent workers y restarts; si no, el gate queda `BLOCKED`.
- [ ] `rollbackAvailable=false` sigue explícito y nunca se simula rollback.

### Gate 4 — Trusted handoff boundaries

**Objetivo**

Impedir que assertions arbitrarias de runtime autoricen booking y dejar contracts verificables para sistemas externos aún fuera de scope.

**Module/file boundaries**

- `src/tms/real/handoff-validators.ts`: schema, binding, freshness, provenance y proof verification.
- Ports internos `TrustedOtpProvider`, `TrustedNegotiationProvider` y `TrustedCarrierValidationProvider`; sus implementaciones externas no forman parte de esta remediation.
- `tests/tms/real/booking-probe.ts`: no rebasa ni reescribe identities; solo consume handoffs ya confiables.

**Contracts/interfaces/data flow**

- Cada proof debe conservar y comparar, sin rebasing, `runId`, `sessionId` y exact `loadId`. Mismatch, missing identity o stale proof es rechazo.
- `TrustedOtpProof` debe demostrar una OTP one-time ligada a caller/session, nonce/replay protection y final acceptance del trusted session boundary. Un `otpVerified: true` proveniente de env JSON no basta.
- `TrustedNegotiationProof` debe contener `agreedRate`, selected-load binding, session/run binding, explicit final acceptance y evidencia independiente de que no se excedieron tres counteroffers. `counterofferCount: 0..3` auto-declarado sin provenance no es prueba.
- `TrustedCarrierValidationProof` debe contener normalized MC, validación vigente, timestamp/reference y binding de carrier/session/load desde un provider confiable. `validated=true` o formato de MC sin proof no basta.
- `AGREED_RATE` no se compara por obligación con posted `RATE`, no se calcula desde `MAX_BUY` y nunca se expone como `max_rate`, `maxBuy` o equivalente.
- Env JSON puede alimentar fixtures local explícitamente no reales, pero ningún real capability puede aceptar ese path como trust source.

**Implementation tasks**

1. Reemplazar casts de `unknown` y caller assertions por ports y DTO validators que requieran provenance/provider proof.
2. Preservar los identifiers suministrados y rechazar mismatch; nunca asignarlos desde `query.run` para ocultar un handoff ajeno.
3. Definir un `TrustedHandoffUnavailable` bloqueante para cuando OTP, negotiation o carrier/FMCSA provider no exista.
4. Mantener la implementación de OTP delivery, FMCSA API y negotiation engine fuera de este plan; solo definir su input/output trust contract.

**Failure behavior**

- Proof ausente, autoafirmado, stale, malformed, replayable o mismatched: `BLOCKED`/terminal pre-write; no booking write.
- Un provider que no puede probar el máximo de tres counteroffers, final acceptance o carrier validation no autoriza el flujo.
- El runner no puede “corregir” el handoff rebasing IDs ni sustituir una prueba por JSON de env.

**Local tests**

- Mismatched `runId`/`sessionId`/`loadId` en cada handoff.
- OTP missing/replay/expired/wrong session.
- Negotiation missing final acceptance, >3 counteroffers, absent provenance, rate inconsistency y unauthorized load.
- Carrier proof missing/stale/unvalidated/wrong carrier/session y MC normalization edge cases.
- Env JSON/caller assertion is rejected by real factory but may be used only by an explicit fake provider test seam.

**Acceptance criteria**

- [ ] Todos los handoffs reales provienen de trusted provider/proof boundaries y no de arbitrary env JSON.
- [ ] No se rebasa `runId`, `sessionId` o `loadId`; todo mismatch bloquea.
- [ ] Negotiation prueba final acceptance y máximo tres counteroffers; `AGREED_RATE` permanece independiente de `RATE` y `MAX_BUY`.
- [ ] Carrier proof confiable y OTP proof verificable son requisitos; si los sistemas externos no están presentes, el resultado es `BLOCKED`.

### Gate 5 — Post-write uncertainty y reconciliation truthful

**Objetivo**

Clasificar conservadoramente cada resultado según la posibilidad real de side effect y permitir como máximo una reconciliation por exact ID, sin retry de booking.

**Module/file boundaries**

- `src/tms/client.ts` / `src/tms/transport.ts`: reportar write disposition y lifecycle técnico.
- `src/tms/real/reconciliation.ts`: única implementación de reconciliation y classifier.
- `src/tms/booking.ts`: parsear/validar el documented booking response; no decidir por sí solo truth de reconciliation.
- `src/tms/real/booking-orchestrator.ts`: aplicar la policy, no duplicarla.

**Contracts/interfaces/data flow**

- Pre-write failure probado antes de transmitir es `not-sent` y deterministic no-side-effect.
- Después de una posible transmisión, callback ambiguity, write error con transmisión incierta, timeout, `EOF`, premature close, malformed response o semantic response incompleta es `side-effect-uncertain`; no se clasifica como deterministic success/failure ni como retryable booking.
- Un complete, valid and documented remote `ERR` mantiene clasificación determinística y terminal, incluso si el outcome no es exitoso.
- Un complete booking success solo es success si verifica documented success contract, exact authorized `loadId`, authorized MC, `AGREED_RATE`, booking reference y timestamp según lo que el TMS documente. Un mismatch o campo faltante después de posible write es uncertainty conservadora.
- Solo `side-effect-uncertain` posterior al write puede consumir un único `LOAD_GET` reconciliation con el exact same ID. Nunca se consulta otro ID ni se reemite `LOAD_BOOK`.
- `reconciled` requiere documented booking state evidence del TMS; un GET transport-success, record presence o callback arbitrario no basta. En cualquier otro caso el outcome es `still-uncertain`.

**Implementation tasks**

1. Modelar `not-sent/sent/unknown` de forma uniforme desde transport hasta outcome.
2. Eliminar las dos rutas duplicadas de reconciliation y centralizar la decisión en `reconciliation.ts`.
3. Separar parse/validation de response de booking de la clasificación operacional.
4. Hacer irreversible el estado `booking-consumed` antes del write y `reconciliation-consumed` antes del único GET.
5. Documentar que incertidumbre remota requiere operación manual posterior; no implementar rollback ni retry.

**Failure behavior**

- No retry, no polling y no alternate ID ante cualquier error post-write.
- Complete remote `ERR` es deterministic terminal; no consume reconciliation salvo que el contrato lo clasifique genuinamente como incertidumbre, no por callback arbitrario.
- Reconciliation no confirmatoria siempre devuelve `still-uncertain`, nunca false success.

**Local tests**

- Write callback error, partial write, timeout, EOF, close race, malformed response y semantic mismatch post-write.
- Complete remote `ERR` conocido/desconocido como deterministic terminal.
- Validación completa de load/MC/rate/reference/timestamp en response success.
- Exactly one reconciliation, exact-ID binding, no retry/replay y `reconciled` solo con documented booking state.
- Outcomes conservan `rollbackAvailable=false` y consumed budgets.

**Acceptance criteria**

- [ ] Toda falla posterior a una posible escritura se clasifica conservadoramente.
- [ ] Complete remote `ERR` permanece determinístico y terminal.
- [ ] Solo existe un camino de reconciliation, con exact ID, máximo una ejecución y documented state evidence.
- [ ] Ningún outcome uncertain puede producir false success o liberar el one-shot.

### Gate 6 — Evidence y observability boundary

**Objetivo**

Producir evidence auditable, exacta y sanitizada sin permitir spread de objetos arbitrarios ni destrucción de provenance histórica.

**Module/file boundaries**

- `src/tms/real/evidence.ts`: summary types, allowlist, sanitizer constructivo, schema version y writer.
- `src/tms/logger.ts`: metadata bounded, sin wire ni secrets.
- `reports/tms/phase-2c/remediation/`: future unique artifacts; `reports/tms/phase-2c/real-controlled-booking.json` es read-only.

**Contracts/interfaces/data flow**

- `SanitizedBookingEvidence` solo puede incluir `schemaVersion`, provenance, stage names (`query`, `selection`, `detail`, `booking`, `reconciliation`), outcome, bounded counts/durations, allowlisted field names, byte counts, terminal/lifecycle, `writeDisposition`, attempt-budget state, classification y `rollbackAvailable:false`.
- No se incluyen domain IDs ni values: `runId`, `sessionId`, `loadId`, filters, MC, `RATE`, `AGREED_RATE`, booking reference, raw wire/rawLine, token, host, port, `NOTES`, `MAX_BUY`, `maxBuy`, `max_rate`, PII o arbitrary remote message.
- La evidencia debe informar timing por stage y provenance real: no-iniciado, failure, deterministic, success, uncertain, reconciled o still-uncertain no se intercambian.
- El writer crea un artifact unique/versioned con append-only/create-only semantics, nunca escribe el fixed historical path y rechaza unknown keys antes de persistir.

**Implementation tasks**

1. Sustituir `{ ...evidence }` por construcción positiva de cada campo permitido.
2. Rechazar claves desconocidas y valores no bounded en la entrada del reporter.
3. Generar artifact identity no derivada de domain IDs y separar provenance de histórico frente a futura ejecución.
4. Aplicar redaction antes de logs, serialization y persistence; no confiar en el caller.
5. Mantener counts, timings y lifecycle exactos aun cuando el outcome sea failure o uncertainty; nunca convertir `not-run` en success.

**Failure behavior**

- Evidence input inseguro, unknown property, sensitive value o writer collision: fail closed; no emitir artifact engañoso.
- Fallo del writer no cambia el `BookingOutcome` ni habilita retry.
- Si la procedencia no puede ser demostrada, el resultado permanece `BLOCKED`/incompleto.

**Local tests**

- Prototype pollution/arbitrary-property, unknown-key, nested-object y oversized-value rejection.
- Assertions de ausencia de values/IDs/MC/rate/raw wire/`NOTES`/`MAX_BUY`/`max_rate`/token/host/port/PII.
- Unique path, append-only, collision y preservation del report histórico.
- Stage timing/provenance, no false success y exact outcome redaction.

**Acceptance criteria**

- [ ] El sanitizer usa strict positive allowlist y nunca spread arbitrario.
- [ ] Los artifacts nuevos son únicos, versionados, append-only y no sobrescriben el report histórico fallido.
- [ ] La evidencia no contiene valores sensibles, domain IDs, raw diagnostics ni `MAX_BUY`/`max_rate`.
- [ ] Timing, lifecycle, provenance y uncertainty son truthful y no false-success.

### Gate 7 — HTTP/resource abuse y regression hardening

**Objetivo**

Cerrar superficies de abuso de recursos y evitar que helpers, routes o diagnósticos reintroduzcan bypasses.

**Module/file boundaries**

- `src/tms/http.ts`, `src/tms/limits.ts`: body/frame/text/depth/key/resource limits y bounded errors.
- `app/api/tms/**/route.ts`: thin boundary; no business rules ni socket access.
- `src/tms/real/reconciliation.ts` y diagnostics centralizados: únicos paths de reconciliation/diagnostics autorizados.
- `src/tms/client.ts` / parser: raw protocol details privados.

**Contracts/interfaces/data flow**

- Rechazar body por byte limit antes de materializar JSON donde el framework lo permita; si se requiere stream, contar bytes durante lectura y abortar antes de parse completo.
- Aplicar límites de text fields, JSON depth/keys, TMS frame bytes, response records/line lengths, socket count, concurrency y end-to-end time budget.
- Aplicar rate/concurrency controls apropiados a routes/mock/runner; el real booking es single-flight y no permite parallel attempts.
- `rawLine`, raw bytes y internal diagnostics nunca cruzan hacia HTTP, reporter, logs públicos o handoff callers.
- Las routes públicas en real deben negar antes de TMS connect/write. Full caller auth sigue siendo future challenge work, no debe declararse resuelto por este gate.

**Implementation tasks**

1. Auditar todos los `request.json()` y aplicar body/text limits antes de parsear o mapear.
2. Centralizar limits y semántica de denial; no duplicar constantes en routes/tests.
3. Añadir concurrency/rate/deadline controls sin permitir que un failure reintente booking.
4. Retirar direct socket use de `load-structural-diagnostic.ts` y reutilizar policy/client/parser/service seams.
5. Verificar que reconciliation y diagnostics tienen una única implementación y boundary.

**Failure behavior**

- Body/frame/text/resource overflow: safe bounded denial; no socket real y no partial booking.
- Saturación, lock contention o rate denial: deterministic blocked outcome; no retry automático.
- Cualquier raw diagnostic crossing o direct socket bypass deja el gate `BLOCKED`.

**Local tests**

- Body limit before JSON parse, oversized text, deep/large JSON, malformed body y oversized frame/response.
- Rate/concurrency/semaphore, single-flight real booking, socket/deadline cleanup y no leaked handles.
- Real-route denial antes de connect/write.
- Static/direct tests de ausencia de `rawLine` público y de un único reconciliation/diagnostic path.

**Acceptance criteria**

- [ ] Body, frame, text, response, socket, rate, concurrency y deadline limits están centralizados y probados.
- [ ] Public real routes son inalcanzables para booking antes de red.
- [ ] Ningún rawLine/raw wire o direct socket bypass cruza boundaries.
- [ ] Handlers permanecen thin y el workflow/reconciliation/diagnostics tienen owners únicos.

### Gate 8 — Verification, independent review y release gate

**Objetivo**

Demostrar localmente los contratos y dejar el real run como una operación separada, aprobada de forma inmediata y explícita, nunca como parte de la implementación.

**Module/file boundaries**

- Toda la implementación futura de `src/tms/**`, `app/api/tms/**`, `tests/tms/**` y writers debe pasar la revisión de ownership y boundaries de este documento.
- Los real runner scripts/configs deben quedar separados de `npm test` y no deben ejecutar `LOAD_BOOK` durante local verification.
- La revisión independiente debe consumir evidence nueva sin alterar el report histórico.

**Contracts/interfaces/data flow**

- Release readiness solo puede ser `READY FOR SEPARATE APPROVAL` cuando Gates 0–7 estén `PASS`, P0 findings estén cerrados, required P1 estén verificados y no haya dependency `BLOCKED`.
- El approval final debe ser un acto separado, inmediato y explícito, con server-only target/secrets, un current approved query/selection, un attempt, no retry y aceptación explícita de `rollbackAvailable=false`.
- La aprobación no puede sustituir target pinning, trusted handoffs, durable ledger, capability isolation, final detail, truthful reconciliation o evidence controls.

**Implementation tasks**

1. Ejecutar la Verification Plan completa, incluida regresión y targeted security tests.
2. Revisar manualmente la checklist P0/P1: F-01 a F-12, con especial atención a capability, public denial, handoffs, durable one-shot, post-write uncertainty, target/transport, evidence y limits.
3. Confirmar diff hygiene y que solo los cambios aprobados de implementation existen; no modificar reportes históricos.
4. Registrar estado de cada gate como `PASS`, `BLOCKED` o `FAIL`; cualquier `BLOCKED` mantiene real booking bloqueado.
5. Entregar al owner una solicitud separada de aprobación; no ejecutar real runner como cierre automático.

**Failure behavior**

- Cualquier test, review item o gate fallido mantiene `NO-GO`.
- Ausencia de provider/ledger/target control o evidencia completa mantiene `BLOCKED`, no permite fixture bypass.
- Local green no se traduce en real success ni autoriza por sí solo `LOAD_BOOK`.

**Local tests**

- Ejecutar los comandos globales de Verification Plan, sin network real.
- Ejecutar targeted tests de capability isolation, public-route denial, identity/handoff binding, durable one-shot/concurrency/restart, final-detail freshness/drift, deterministic versus uncertain outcomes, truthful reconciliation, evidence preservation/redaction, target/config guards e input limits.
- Confirmar que no se ejecuta `npm run test:real-tms:booking` y que no se envía `LOAD_BOOK`.

**Acceptance criteria**

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check` pasan después de la implementación futura.
- [ ] Todas las targeted security/regression tests pasan y cubren cada P0/P1 requerido.
- [ ] Todos los Gates 0–7 están `PASS`, sin dependency bloqueante y con revisión independiente.
- [ ] El estado sigue `REAL BOOKING BLOCKED` hasta que exista aprobación separada; ningún local check ejecuta booking real.

## Implementation Steps

1. **Gate 0:** preservar provenance y report histórico, definir output path único y capturar baseline local sin real operations.
2. **Gate 1:** validar candidate target/pinning, transport security o compensating control, bounded deadlines, egress y no-secret/fail-closed behavior.
3. **Gate 2:** sellar la real booking capability al orchestrator, eliminar generic-client/public-route/diagnostic escape hatches y conservar mock solo en scope local explícito.
4. **Gate 3:** descomponer state machine, selection, final-detail authorization y durable atomic one-shot; bloquear si no existe durable ledger.
5. **Gate 4:** introducir trusted OTP/negotiation/carrier handoff ports, rechazar mismatches y bloquear si no existe proof provider confiable.
6. **Gate 5:** unificar write disposition, deterministic errors, post-write uncertainty y exact-ID reconciliation truthful, sin retries.
7. **Gate 6:** reconstruir evidence por allowlist positiva, con timing/provenance correctos y artifacts unique append-only sin tocar el historical report.
8. **Gate 7:** aplicar body/text/frame/resource/rate/concurrency limits, real-route denial y centralización de diagnostics/reconciliation.
9. **Gate 8:** ejecutar verificación local, revisión independiente y release checklist; solicitar aprobación separada sin ejecutar el real runner.
10. **Operación futura separada:** solo después de los gates y una aprobación explícita se podrá considerar un one-shot real con valores server-only, una query/selection actual aprobada, un attempt, sin retry y con `rollbackAvailable=false`. Esa operación no forma parte de esta implementación ni de su verificación local.

## Edge Cases

- Query con zero results: es un resultado válido de query, pero no autoriza fabricar un ID ni continuar a detail/booking.
- Query con multiple results: exige explicit selection; nunca elegir el primero automáticamente.
- Sole result: shortcut solo con `maxResults=1` y separate explicit confirmation; siempre bind exact ID.
- `runId`, `sessionId` o `loadId` supplied por handoff no coincide: rechazo, nunca runner rebasing.
- Final detail stale, missing, malformed o materialmente distinto: no write; si el ledger ya fue consumido, no se restaura.
- `RATE` y `AGREED_RATE` difieren: no es automáticamente un error; `AGREED_RATE` proviene del trusted negotiation proof. Nunca derivar desde `MAX_BUY`/`max_rate`.
- Complete remote `ERR`: deterministic terminal. Callback/EOF/timeout/malformed/semantic response tras posible write: `side-effect-uncertain`.
- Reconciliation GET con response válida pero sin documented booking state: `still-uncertain`, no `reconciled`.
- Restart, second worker, concurrent invocation o replay: durable ledger rechaza un segundo attempt sin write.
- Missing TLS/private-network approval, target pinning, trusted provider o durable ledger: `BLOCKED`.
- Historical `NOT_FOUND` report: preserved as failed/preflight; nunca se usa como current candidate ni se reescribe.
- Oversized body, frame, text, response, rate/concurrency load o timeout: bounded denial/failure sin fallback real/mock silencioso.

## Verification Plan

### Required local commands after implementation

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`

Todos deben ejecutarse con real runners excluidos, sin secrets requeridos, sin red externa y sin `LOAD_BOOK`. No ejecutar `npm run test:real-tms:booking` como parte de esta verificación.

### Required targeted tests

- [ ] Capability isolation: generic `TmsClient`, `service`, routes, 2A, 2B, CI, default tests y diagnostics no pueden obtener real booking capability.
- [ ] Public-route denial: `/api/tms/loads/book` y cualquier route pública deniegan real booking antes de connect/write; mock behavior, si se conserva, queda local-only.
- [ ] Exact identity/handoff binding: query/run/session/load continuity, no rebasing, explicit selection y trusted OTP/negotiation/carrier proof.
- [ ] Durable one-shot: atomicity, concurrency, multi-worker, restart/crash, replay, fencing, no retry y no budget restoration.
- [ ] Final detail freshness/drift: exact ID, material fields, TTL, status semantics y final pre-write ordering.
- [ ] Outcome classification: `not-sent/sent/unknown`, complete remote `ERR`, deterministic failure, callback/EOF/malformed/semantic uncertainty.
- [ ] Truthful reconciliation: one exact-ID GET máximo, documented booking state para `reconciled`, `still-uncertain` otherwise.
- [ ] Evidence preservation/redaction: positive allowlist, unknown properties, path collision, append-only/versioning, historical failed report intact y sensitive values ausentes.
- [ ] Target/config guards: exact flags, allowlist/pinning, transport control, bounded timeouts, no fallback y no secret leakage.
- [ ] Input/resource limits: body before parse, text/JSON/frame/response limits, rate/concurrency/deadline controls y cleanup.
- [ ] Regression: Phase 1 local, Phase 2A echo-only y Phase 2B read-only contracts permanecen intact.

### Review checklist y release decision

- [ ] F-01/P0 generic capability bypass cerrado.
- [ ] F-02/P0 real booking inaccesible desde public routes; full endpoint auth explícitamente pendiente del challenge.
- [ ] F-03/P0 trusted handoff boundary presente o estado `BLOCKED`.
- [ ] F-04/P0 post-write uncertainty y no-retry semantics uniformes.
- [ ] F-05/P0 durable atomic one-shot crash-safe o `BLOCKED`.
- [ ] F-06/F-07/F-08 P1 identity, final detail, response verification y reconciliation centralizados.
- [ ] F-09/P1 target pinning, transport control y bounded timeout.
- [ ] F-10/P1 evidence allowlist, unique artifacts y preservation histórica.
- [ ] F-11/P1/P2 decomposition, no raw boundary bypass y thin runner/routes.
- [ ] F-12/P1 resource/input limits y concurrency hardening.
- [ ] Una revisión independiente confirma todos los criterios antes de solicitar aprobación.
- [ ] Sin aprobación separada, la decisión es `NO-GO` aunque todos los checks locales pasen.

## Rollback Plan

- [ ] Para cambios de código futuros, revertir solo la remediation aprobada mediante el mecanismo normal de version control, preservando Phase 1, 2A, 2B y el report histórico.
- [ ] Deshabilitar el real activation/capability y volver a `mock-local` explícito; nunca convertir config parcial en fallback silencioso.
- [ ] Ante side effect uncertainty, conservar el attempt consumido, clasificar `still-uncertain` si no hay proof y escalar manualmente; no usar `LOAD_BOOK`, retry, polling o simulated rollback.
- [ ] `rollbackAvailable=false` debe permanecer en cada outcome y artifact; no prometer unbooking inexistente.
- [ ] Si falta una dependencia externa o el target cambia, detener y dejar el release `BLOCKED`; no relajar gates.

## Acceptance Criteria

- [ ] El documento y la implementación futura mantienen el estado `PLAN READY — REAL BOOKING BLOCKED UNTIL GATES PASS` hasta un release aprobado separadamente.
- [ ] Phase 1 está cerrada; 2A y 2B conservan su evidencia real observada/condicional, sin confundirla con complete reconciliation documentation.
- [ ] Phase 2C local conserva su workflow y checks históricos como evidencia `LOCAL-ONLY`; la remediation añade targeted coverage sin afirmar booking real.
- [ ] El real `LOAD_BOOK` permanece `NO-GO` hasta que Gates 0–8 pasen, los P0 y required P1 estén revisados y exista aprobación separada.
- [ ] Candidate target, config, transport, timeouts y egress son fail-closed, pinneados/aprobados y libres de secret exposure.
- [ ] Generic clients, public routes, 2A, 2B, tests y diagnostics no pueden alcanzar real booking capability.
- [ ] La única real capability es opaque, server-only, workflow-owned y requiere state machine, explicit selection, final detail y durable atomic one-shot.
- [ ] `runId`, `sessionId`, exact `loadId`, carrier proof y negotiation proof conservan identidad sin rebasing; ausencia de trusted providers bloquea.
- [ ] `AGREED_RATE` es independiente de posted `RATE`; nunca se deriva desde `MAX_BUY`, `maxBuy` o `max_rate`, y ningún max value se expone.
- [ ] La booking response se verifica completamente según el documented TMS contract; deterministic `ERR` y post-write uncertainty se clasifican sin retry.
- [ ] Existe una sola reconciliation path, exact-ID y one-shot; `reconciled` exige documented booking state y lo demás es `still-uncertain`.
- [ ] Evidence usa positive allowlist, timing/provenance accurate, artifacts únicos/append-only y no contiene values, IDs, MC, rate, raw wire, `NOTES`, `MAX_BUY`, token, host, port o PII.
- [ ] Body/frame/text/resource/rate/concurrency limits están implementados y probados; routes y runner son thin y no contienen business rules.
- [ ] `controlled-booking.ts` no queda como monolith de policy, IO, mapping, handoffs, state, reconciliation y reporting.
- [ ] La matriz de aceptación distingue observed 2A/2B, complete reconciliation pendiente, 2C local, 2C real readiness y full challenge futuro.
- [ ] La verificación futura pasa `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`, sin ejecutar el real booking command.

## Acceptance Matrix

| Área | Estado que debe preservarse | Evidencia/interpretación | Bloqueo de este plan |
| --- | --- | --- | --- |
| Phase 2A `DEBUG_ECHO` | `CONDICIONAL GO / OBSERVED MET` | Evidencia real histórica observada; no prueba commands operativos. Complete handbook ↔ real ↔ mock reconciliation sigue siendo un trabajo documental separado. | No reabrir salvo regresión; no habilita booking. |
| Phase 2B `LOAD_QUERY`/`LOAD_GET` | `CONDICIONAL GO / OBSERVED MET` | Evidencia real read-only histórica; no equivale a reconciliación completa zero/multiple/error/lifecycle. | Debe permanecer read-only y no entregar booking capability. |
| Phase 2C local | `IMPLEMENTED LOCALLY — LOCAL-ONLY / REVISION REQUIRED` | Workflow y checks históricos verdes son evidencia local, no real side-effect proof. | Debe pasar Gates 0–8 antes de readiness real. |
| Phase 2C real booking | `NOT ACCEPTED / NO-GO / BLOCKED` | No existe booking real exitoso verificado; historical report es failed/preflight `NOT_FOUND`. | Bloqueado hasta todos los gates y aprobación separada. |
| Full challenge | `FUTURE / OUT OF SCOPE` | HappyRobot, OTP delivery, FMCSA integration, negotiation engine, Twin, Apps, deployment, KPIs y submission deliverables no forman parte de esta remediation. | No bloquean este plan como producto completo, pero trusted proof providers sí bloquean el real Phase 2 handoff. |

## Handoff

Este artifact es únicamente el plan. La siguiente ejecución debe entregarse manualmente a `@coder-heavy`; este documento no autoriza ningún cambio fuera de `.spec.md` durante la planificación. El coder no debe ejecutar real booking, `npm run test:real-tms:booking` ni enviar `LOAD_BOOK`. Después de implementar y revisar todos los gates, se requiere una aprobación explícita separada para considerar una única ejecución real, sin retry y aceptando `rollbackAvailable=false`.
