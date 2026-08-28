# Phase 2 — Cierre de gates críticos y handoff a Phase 3

**Tipo:** especificación de implementación acotada para `@coder-heavy`  
**Estado:** `PLAN READY — REAL BOOKING BLOCKED UNTIL GATES PASS`  
**Relación:** addendum de cierre de [`phase-2-security-gates-remediation.spec.md`](./phase-2-security-gates-remediation.spec.md). No reescribe historia ni autoriza un side effect real.

## Context

Esta entrega cierra Phase 2 únicamente cuando los controles críticos del adapter están implementados, probados localmente, fail-closed y revisados de forma independiente. El resultado esperado es un adapter demostrablemente seguro y un handoff explícito a Phase 3; no es una autorización de `LOAD_BOOK` real.

### Evidencia y baseline que deben preservarse

- Stack: Next.js 16, TypeScript 5.8, Vitest 3.2.7.
- Scripts de verificación: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`.
- Baseline observado: `npm test` verde con 23 archivos/236 tests; typecheck, lint, diff-check y suite client dirigida 16/16 verdes. Esta evidencia no demuestra que los gaps siguientes estén corregidos.
- No se ejecutó TMS real ni `LOAD_BOOK`; tampoco debe ejecutarse en este pass. El runner real debe permanecer fuera de la suite local.
- La spec existente conserva `PLAN READY — REAL BOOKING BLOCKED UNTIL GATES PASS`. El reporte histórico `reports/tms/phase-2c/real-controlled-booking.json` no se modifica, relabela ni sobrescribe.

### Gaps actuales a cerrar

La implementación observada aún expone `RealBookingCapability`, una factory con `confirmed: boolean` y una booking-port factory desde `src/tms/policy.ts`; el ledger de `src/tms/attempt-ledger.ts` usa `open(..., "wx")` sin commit durable completo, verificación de binding ni fencing de crash/restart; `src/tms/transport.ts` solo ofrece `net.createConnection` plaintext; configuración, target pinning/allowlist y aprobación de red privada se tratan como valores del mismo entorno; `src/tms/controlled-booking.ts` mezcla state machine, orquestación, validación e IO y acepta handoffs shape-only/predicate reconciliation; la route pública permite mutación mock sin autenticación; y `src/tms/http.ts` carece de límites estructurales JSON. También faltan controles completos de echo text, rate/concurrency y deadline end-to-end.

### Semántica de cierre y límites de fase

- La ausencia de proveedor externo, autoridad de target/egress o durable store no se resuelve con fixtures que parezcan producción: el resultado es `BLOCKED` y la evidencia debe probarlo.
- Phase 2 no incorpora HappyRobot, OTP delivery, FMCSA, negotiation engine, Twin, Apps ni deployment/integrations. Phase 3 aportará proveedores reales, autoridad de target/egress y proofs operativos.
- Aunque todos los controles locales pasen, real `LOAD_BOOK` permanece deshabilitado hasta que Phase 3 entregue dependencias confiables y exista una aprobación separada y explícita. No se deben fabricar proofs ni declarar real readiness.

## Dependencies / Inputs

- [ ] Código actual y contratos de `src/tms/**`, `app/api/tms/loads/book/route.ts` y tests existentes.
- [ ] `specs/implementation/phase-2-security-gates-remediation.spec.md` y specs 2A/2B/2C como contexto; esta spec agrega el handoff, no crea un contrato funcional competidor.
- [ ] `HR-LTMS-PR-001` y evidencia histórica sanitizada de 2A/2B; cualquier divergencia requiere clasificación antes de relajar una validación.
- [ ] Proveedor server-only de verificación de handoffs, con clave/issuer confiables; si no existe, la factory real devuelve `BLOCKED`.
- [ ] Autoridad server-only independiente para target y egress, con manifest/adapter verificable; el valor de request/config no puede ser su propia aprobación.
- [ ] Transporte TLS aprobado, CA/certificados y server-name verification; sin ello el camino real queda bloqueado.
- [ ] Ledger durable aprobado. Se admite filesystem crash-safe o un store durable equivalente; no se admite sustituto en memoria.
- [ ] Contrato de caller trusted (subject, role/scope y eventualmente proxy confiable). Hasta integrarlo, la route pública usa default-deny.
- [ ] No incluir secretos, host/port reales, tokens, MC, rates ni IDs operativos en código, fixtures, logs, reportes o esta spec.

## Files / Modules

- [ ] `src/tms/limits.ts` — constantes nombradas para body/frame/text/JSON, rate, concurrency, socket y deadlines.
- [ ] `src/tms/deadline.ts` — presupuesto end-to-end, fases, remaining budget y cancelación/cleanup.
- [ ] `src/tms/resource-controls.ts` — rate limiter bounded y semaphore rejecting, con ports para store distribuido.
- [ ] `src/tms/json-limits.ts` — validador puro de límites estructurales y claves peligrosas después de lectura acotada.
- [ ] `src/tms/real/capability.ts` — boundary interna/server-only de la capability real opaca.
- [ ] `src/tms/real/booking-orchestrator.ts` — único owner del workflow real y del write `LOAD_BOOK`.
- [ ] `src/tms/real/authorization.ts` — autorización inmutable, scopes, binding y transiciones.
- [ ] `src/tms/real/handoff-proof.ts` y/o `src/tms/real/handoff-validators.ts` — envelope versionado, verificación criptográfica, binding y replay.
- [ ] `src/tms/real/target-authority.ts` — contrato de aprobación independiente de target/egress.
- [ ] `src/tms/attempt-ledger.ts` — port pequeño `BookingAttemptLedger` y adapter durable; no booleano process-local.
- [ ] `src/tms/transport.ts`, `src/tms/config-core.ts` y cliente — consumir solo target validado, TLS y deadline; sin raw env ni fallback plaintext.
- [ ] `src/tms/controlled-booking.ts` — reducir a façade/orchestrator thin o retirar; extraer reglas y adapters indicados abajo.
- [ ] `src/tms/real/selection.ts`, `identity.ts`, `reconciliation.ts`, mappers/DTOs y classifier equivalente — reglas puras, autoridad y salidas cerradas.
- [ ] `src/tms/caller-authorization.ts` o equivalente server-only — guard/port de caller trusted.
- [ ] `app/api/tms/loads/book/route.ts` y routes relacionadas — parsing, límites, auth/denial y mapping seguro; nunca capability ni business rules.
- [ ] `src/tms/policy.ts`, `src/tms/client.ts`, `src/tms/service.ts` y diagnostics — eliminar factories/escape hatches de real booking.
- [ ] `tests/tms/**` y `tests/tms/real/**` — unit, integration, static API, crash/restart, route denial y seguridad; los tests reales siguen excluidos de `npm test`.

## Module Boundaries / Contracts

### Capability, policy y caller

- `RealBookingCapability` será opaca, interna y server-only. No tendrá constructor/factory pública, no se podrá serializar y ningún `confirmed: boolean`, cast, header o valor de env podrá acuñarla.
- Solo el orchestrator dedicado podrá consumirla, después de policy, authorization, target, handoffs, detail final y claim durable. `GenericTmsClient`, `service`, mock, tests normales, diagnostics y HTTP no podrán emitir real `LOAD_BOOK`.
- La route pública `POST /api/tms/loads/book` debe default-deny de forma segura (preferentemente 403/404) antes de cualquier mutación o conexión. La cobertura de mutación mock se mueve a tests directos de servicio/fixtures; no se mantiene como mutación de una route con apariencia productiva.
- Si se integra un guard de caller, exige subject trusted y role/scope ligado a la operación. Headers arbitrarios solo son válidos bajo un contrato explícito de proxy trusted.

### Handoff proofs

Definir un envelope versionado con, como mínimo: `proofKind`, `issuer`, `keyId`, binding exacto de `loadId`/`runId`/`sessionId`, digest del payload, `issuedAt`, `expiresAt`, nonce/replay id y signature/MAC. Un verifier server-only inyectado debe validar firma/MAC, issuer/key, digest, TTL, nonce no reutilizado y todos los bindings.

- OTP, negotiation y carrier/FMCSA consumen ports de trusted providers; no se implementan esos productos en Phase 2.
- Shape validation, `env JSON`, booleans del caller y casts no son proofs de producción.
- Handoff faltante, issuer/key desconocido, firma inválida, expiración, replay, binding incorrecto, provider ausente o agreed rate/MC inconsistente devuelve `BLOCKED` antes del connect/write.
- Fixtures pueden usar un signer/provider explícitamente `test-only`, sin camino para activar production real mode.

### Ledger durable y write disposition

El port `BookingAttemptLedger` debe guardar por identidad de load el digest exacto del binding, claim/fence token y estado. El claim one-shot usa create-only atómico: temp file/write/fsync/rename/fsync de directorio, o un store durable equivalente aprobado.

- Un registro existente se verifica; duplicate, binding mismatch, corrupción, vacío, permission failure, fsync failure, crash o fencing conflict consumen/bloquean conservadoramente y nunca permiten otro write.
- Debe existir seam de crash simulation y prueba multi-proceso/concurrent workers. No hay recovery automático que pueda reenviar booking, ni `release`, retry o sustituto en memoria.
- Estados técnicos distinguen `not-sent`, `sent` y `unknown`. Tras posible transmisión, timeout, EOF, close, callback ambiguo, malformed response o error de escritura incierto se conserva incertidumbre y el claim.
- `rollbackAvailable` permanece `false`; no se simula unbooking.

### Target, egress y transporte

- `ValidatedRealTarget` es el único input del connector; nunca recibe raw env. Una autoridad independiente entrega/aprueba identidad de candidate, endpoint exacto, allowlist/pin, egress esperado y modo de transporte.
- El mismo request/config value que se valida no puede ser la autoridad. Un mismatch de target o egress bloquea antes de abrir socket.
- Real transport es TLS con verificación de certificado y server name (`rejectUnauthorized: true`); no existe fallback plaintext. TCP loopback queda limitado a mock/test.
- Connect, handshake, response y deadline end-to-end tienen límites finitos y superiores centralizados; timeout destruye socket y limpia listeners. No hay retry silencioso ni fuga de secretos.

### Límites y deadline

- `resource-controls.ts` ofrece rate limiting token-bucket/fixed-window keyed por identidad trusted o bucket anónimo, con número de claves y eviction bounded. La saturación devuelve 429 y `Retry-After` cuando aplica.
- Un semaphore rejecting limita operaciones TMS in-flight, no crea cola ilimitada y libera permits en `finally`, error y timeout; se aplica en route y seams runner/client. El control in-memory se documenta como local-only: sin store distribuido inyectado, la mutación real/pública sigue bloqueada.
- Tras la lectura acotada de body de 32 KiB, `json-limits.ts` rechaza depth, object keys, array items, string bytes, números no finitos/no acotados, claves `__proto__`, `constructor`, `prototype` y estructuras no plain. Errores son bounded y no reflejan input crudo.
- El límite de texto de echo se aplica en HTTP/parser por bytes, no solo después de TCP.
- `DeadlineBudget` cubre auth, rate/concurrency admission, config, connect, TLS, write, response, parse, mapping y reconciliation. Cada fase usa el restante; se propaga por query/detail/book/reconcile. La cancelación debe cerrar IO y limpiar timer/listener; `Promise.race` sin abortar la operación no es aceptable.

### Workflow y datos públicos

- `controlled-booking` queda como orchestrator fino. Selection, identity binding, authorization, validation, reconciliation, mapping, limits y side effects tienen owners separados y seams testeables.
- La reconciliation usa un `AuthoritativeReconciliationClassifier` typed; no acepta predicate del caller. Sin autoridad documented, el resultado es `still-uncertain`/`BLOCKED`.
- `LOAD_BOOK` solo sigue query → selección explícita → detail exacto fresco → handoffs verificados → authorization → claim durable → un write → outcome conservador → como máximo un `LOAD_GET` exact-ID.
- DTOs públicos son cerrados y sanitizados. `rawLine`, raw bytes, sockets y diagnostics permanecen privados; ningún DTO público, log público o report expone `rawLine`.

## Extraction Plan

- Extraer primero constantes de `limits.ts`, `DeadlineBudget`, JSON validator y controles de recursos; son puras, reutilizables y fáciles de probar sin red.
- Separar capability/policy/HTTP caller de la booking workflow. La route no decide state transitions ni recibe capability.
- Separar handoff envelope/verifier de providers externos; el verifier recibe una autoridad inyectada y devuelve tipos cerrados.
- Encapsular persistence detrás de `BookingAttemptLedger`; el orchestrator no conoce filesystem ni store concreto.
- Dividir `controlled-booking.ts` en orchestrator, selección explícita, identity/binding, autorización, mappers, classifier y reconciliation.
- Mantener parser/transport/client libres de reglas de booking; mantener diagnostics/raw wire privados.
- Centralizar límites, TTL, estados, scopes, outcomes y nombres de error; no duplicar literales en routes/tests.

## Modularity Risks

- [ ] **God module:** no conservar en `controlled-booking.ts` state machine, validación, handoffs, IO, mapping y reconciliation juntos.
- [ ] **Capability bypass:** no exportar factory pública ni aceptar `confirmed`/casts para real mode.
- [ ] **Self-attested trust:** no sustituir firma, issuer, nonce y binding por shape checks o env JSON.
- [ ] **Process-local safety:** no usar booleanos/memoria para one-shot, rate global o fencing.
- [ ] **Authority confusion:** no dejar que config/request sea simultáneamente target y aprobador de egress.
- [ ] **HTTP mutation:** no conservar booking mutation pública no autenticada, ni ocultarla bajo una etiqueta mock engañosa.
- [ ] **Resource leak:** toda admisión, timer, listener y socket debe tener cleanup en `finally`/abort.
- [ ] **Information leak:** no propagar `rawLine`, secretos, input crudo o target en DTOs/logs/errors.
- [ ] **Scope creep:** no añadir integraciones HappyRobot/OTP/FMCSA/negotiation/Twin/Apps/deployment; solo sus ports y pruebas de ausencia/bloqueo.

## Technical Approach

Aplicar defensa en profundidad y fail-closed. El camino real debe ser inalcanzable desde superficies genéricas y debe quedar bloqueado si alguna autoridad, proof, target, TLS, ledger, caller o límite requerido no está disponible. El éxito local de tests prueba contracts y denials; no prueba conectividad ni side effect real.

La implementación debe conservar `mock-local` como scope separado para regresión, sin compartir capability, target ni secrets del camino real. Los outcomes post-write son irrevocables respecto del attempt: una incertidumbre se reconcilia como máximo una vez por exact ID y, si no hay evidencia autoritativa, permanece `still-uncertain`. No se reintenta booking, no se hace polling y no se simula rollback.

### Orden obligatorio de ejecución

No reordenar las dependencias:

A. Baseline, tests de boundary e inventario estático de APIs; preservar evidencia histórica y excluir real runner.  
B. Crear `limits`, deadline, resource controls y JSON validator; incluir echo text cap.  
C. Implementar transporte TLS y autoridad independiente de target/egress; configuración fail-closed.  
D. Aislar capability y añadir caller authorization/default-deny.  
E. Implementar handoff proofs, binding exacto y anti-replay.  
F. Refactorizar ledger durable, claim atómico, fencing y semántica conservadora de crash/restart.  
G. Descomponer controlled workflow y reconciliación autoritativa, manteniendo disposición de write conservadora.  
H. Integrar route/client/runner, eliminar escape hatches y actualizar tests.  
I. Ejecutar verificación completa y revisión independiente; no ejecutar `LOAD_BOOK` real.

## Implementation Steps

1. **A — Baseline y boundary inventory:** capturar el estado local indicado, identificar exports/imports que puedan acuñar capability, confirmar que el runner real no se descubre en `npm test` y proteger el reporte histórico.
2. **B — Primitives:** centralizar límites; implementar validación JSON pura después del body cap, echo byte cap, rate limiter bounded, semaphore rejecting y `DeadlineBudget` con cancelación verificable.
3. **C — Target/TLS:** definir `ValidatedRealTarget` y `TargetAuthority`; separar aprobación de la config/request, validar egress/pin/allowlist y hacer que el connector solo acepte ese contrato. Eliminar plaintext fallback.
4. **D — Boundary de capability/caller:** mover la factory real a server-only/internal, eliminar `confirmed: boolean` y ports genéricos de booking; hacer que la route pública niegue antes de mutar o conectar y aislar mutación mock en tests directos.
5. **E — Proofs:** definir envelope versionado y verifier inyectado; validar firma/MAC, issuer/key, digest, TTL, nonce/replay y `loadId`/`runId`/`sessionId`/MC/rate. Probar provider ausente y signer test-only como bloqueos.
6. **F — Ledger:** definir port/adapters durable, exact binding digest, claim/fence token y estados. Implementar commit crash-safe o store equivalente aprobado; no añadir recovery que pueda reenviar.
7. **G — Workflow:** extraer selección/identidad/autorización/mappers/classifier/reconciliation; imponer detail final fresco, exact-ID, trusted handoffs y un único `LOAD_BOOK`. Sustituir predicate caller por classifier typed.
8. **H — Integración:** propagar deadline y controles en route/runner/client, cerrar listeners/sockets/permits en todos los caminos, retirar sockets directos y exports antiguos, mantener `rawLine` privado y actualizar pruebas sin activar real mode.
9. **I — Cierre:** ejecutar la matriz de verificación, registrar `PASS`/`BLOCKED`/`FAIL` por control, solicitar revisión independiente y dejar handoff a Phase 3. Ningún paso ejecuta TMS real ni cambia el reporte histórico.

## Edge Cases

- Capability ausente, scope inválido o intento desde route/client/service/mock/test: denial antes de connect/write.
- Handoff con firma inválida, issuer/key incorrecto, expirado, replay, digest distinto, wrong load/run/session, MC/rate distinto o provider ausente: `BLOCKED`.
- Ledger duplicate, binding mismatch, restart, worker concurrente, crash antes/después de rename, record corrupto/vacío, fsync/permiso fallido: claim consumido o bloqueado; nunca segundo write.
- Target/egress mismatch, CA/name incorrectos, handshake timeout o TLS no verificable: bloqueo antes de socket; jamás plaintext.
- Rate excedido, demasiadas claves, eviction, semaphore lleno, error/timeout posterior a admisión: 429/503 seguro, `Retry-After` cuando aplique y permit liberado.
- JSON malformado, UTF-8 inválido, body streaming mayor a 32 KiB, depth/key/array/string/number fuera de límite o prototype key: rechazo antes de schema de route.
- Echo text sobredimensionado: rechazo por bytes antes de enviarlo al transporte.
- Deadline agotado durante auth, admission, connect, TLS, write, response, parse o reconciliation: destruir IO, limpiar timer/listener, no retry.
- Query sin resultados: no inventar ID. Múltiples resultados: selección explícita; nunca first-result implícito.
- Detail stale/missing/drift, response `ERR` completa, callback/EOF/malformed/semantic response post-write: outcome terminal determinístico o `side-effect-uncertain` según write disposition; no replay.
- Reconciliation sin autoridad o sin documented booking state: `still-uncertain`, nunca false success.
- Dependencia externa no disponible: `BLOCKED` seguro es el comportamiento correcto y evidencia válida de Phase 2.

## Verification Plan

### Matriz dirigida obligatoria

- [ ] Capability: ningún public route, generic client, service, mock, test o diagnostic puede acuñar/usar capability real; scope inválido bloquea antes de connect/write.
- [ ] Handoffs: se cubren firma inválida, issuer, expiración, replay nonce, load/run/session incorrectos, agreed rate/MC inconsistente, provider ausente y rechazo de signer/provider test-only en production.
- [ ] Ledger: duplicate, binding mismatch, restart, workers concurrentes, crash antes de rename y después de rename, corrupt/empty record, fsync failure y permission failure; todos son conservadores y sin segundo write.
- [ ] TLS/authority: identidad/certificado, CA/name incorrectos, handshake timeout, ausencia de plaintext fallback, aislamiento de mock TCP y mismatch target/egress antes de socket.
- [ ] Recursos: allowance/rejection/`Retry-After`, memory bounded/eviction, semaphore saturation, release on error/timeout y ausencia de cola ilimitada.
- [ ] JSON/echo: depth, keys, arrays, strings, números, prototype keys, malformed UTF-8, streaming oversized body, echo byte cap, errores seguros y sin raw input.
- [ ] Deadline: agotamiento en cada fase end-to-end, destrucción de socket, listeners/timers/permits limpiados y ausencia de retry.
- [ ] Route: booking público default-deny, sin state mutation y sin TMS connect; si existe auth real, solo caller trusted y scope correcto.
- [ ] Workflow: exact selection/detail/handoff binding, authoritative reconciliation, write disposition, `rollbackAvailable=false` y `rawLine` ausente de DTOs públicos.
- [ ] Regresión: suite local de Phase 1, 2A echo-only, 2B read-only, cliente dirigido 16/16 y tests de integración existentes.

### Comandos y revisión

- [ ] Ejecutar `npm test` (23 archivos/236 tests como baseline esperado o explicar cualquier cambio), `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`.
- [ ] Confirmar que los tests real TMS permanecen excluidos, no se requieren secrets/red externa y no se ejecuta `npm run test:real-tms:booking`.
- [ ] Ejecutar revisión estática de exports/imports, rutas a socket, `rawLine`, `confirmed: boolean`, env JSON y cualquier fallback/retry.
- [ ] Revisión independiente de seguridad/arquitectura debe registrar cada control como `PASS`, `BLOCKED` o `FAIL`; ningún critical finding puede quedar abierto.
- [ ] La evidencia de cierre debe distinguir control implementado y probado de dependencia externa aún `BLOCKED`; no convertir verde local en real readiness.

## Rollback

- [ ] Mantener real booking deshabilitado durante cualquier rollback; no introducir bypass para recuperar funcionalidad.
- [ ] Revertir solo cambios de esta remediation por version control, preservando specs, evidencia histórica, Phase 1/2A/2B y el reporte failed/preflight.
- [ ] No resetear claims consumidos, no reabrir un attempt incierto, no reintentar `LOAD_BOOK` y no simular unbooking.
- [ ] Si falla una dependencia, target, TLS, ledger, proof o revisión, dejar resultado `BLOCKED` y volver al comportamiento mock-local explícito únicamente donde ya sea seguro.
- [ ] Eliminar/aislar controles nuevos no debe crear rutas públicas de mutación ni fallback plaintext; cualquier rollback que no pueda conservar estas invariantes es inválido.

## Acceptance Criteria

- [ ] No existe escape hatch público/genérico para acuñar o consumir real capability/booking port; `confirmed: boolean`, casts, env JSON y diagnostics no pueden activar real booking.
- [ ] Handoffs usan envelope versionado y proof criptográficamente verificado, binding exacto y anti-replay; provider/authority ausente produce `BLOCKED` fail-closed.
- [ ] Existe ledger durable one-shot, atómico y crash-safe con digest de binding, fencing y recuperación conservadora; no hay sustituto en memoria ni segundo write.
- [ ] Target y egress son aprobados por autoridad independiente; el transporte real usa TLS con certificado/server-name verification y sin fallback plaintext.
- [ ] Caller auth trusted está integrado, o `POST /api/tms/loads/book` queda default-deny sin mutación ni conexión TMS; headers arbitrarios no autorizan.
- [ ] Rate limiting bounded, concurrency rejecting, límites completos JSON/body/frame/text y echo text byte cap están centralizados, aplicados y probados.
- [ ] Un deadline end-to-end cubre auth, admission, config, TLS, IO, parse, mapping y reconciliation; timeout destruye IO y limpia timers/listeners/permits sin retry.
- [ ] `controlled-booking` queda descompuesto con orchestrator fino, classifier autoritativo y DTOs públicos sin `rawLine`/raw wire.
- [ ] Se conservan identidad exacta, selección explícita, detail final, `AGREED_RATE` independiente de `RATE`/`MAX_BUY`, write disposition conservadora, una sola reconciliation exact-ID y `rollbackAvailable=false`.
- [ ] Pasan `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`, además de toda la matriz dirigida y la regresión local.
- [ ] Una revisión independiente registra cero unresolved critical findings; cualquier dependencia externa no disponible figura explícitamente como `BLOCKED`, no como ready.
- [ ] Este pass no ejecuta TMS real ni `LOAD_BOOK`, no modifica evidencia histórica y no realiza unbooking/retry.
- [ ] El handoff a Phase 3 es explícito: Phase 3 debe aportar proveedores trusted, autoridad target/egress y aprobación separada antes de cualquier consideración de real `LOAD_BOOK`; hasta entonces la seguridad intencional es `REAL BOOKING BLOCKED`.
