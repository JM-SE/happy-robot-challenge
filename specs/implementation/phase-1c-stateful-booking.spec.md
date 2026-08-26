# Phase 1C — Stateful Local LOAD_BOOK Specification

## Context

Esta fase depende de 1B aprobado y añade únicamente booking local stateful. El nuevo endpoint es `POST /api/tms/loads/book`; la lectura y `DEBUG_ECHO` deben conservarse. No se implementa negociación completa ni se expone `MAX_BUY`.

No aplica Visual Fidelity: no hay UI, Figma, maquetación ni Playwright visual.

## Dependencies / Inputs

- [ ] Gates 1A y 1B aprobados, incluidos contratos de errors/envelopes, cliente de una conexión/request y dataset read-only.
- [ ] Body público exacto `{loadId, mcNumber, agreedRate}`; se conserva la compatibilidad del handoff donde `agreedRate` puede ser `string | number` antes de normalizarlo.
- [ ] Reglas existentes de auth, limits, logging seguro y no exposición de `MAX_BUY`.
- [ ] No TMS real, FMCSA, HappyRobot, red externa, retry automático ni negociación completa.

## Files / Modules

- [ ] `app/api/tms/loads/book/route.ts` — único handler nuevo; `runtime = "nodejs"`; validación/delegación/envelope.
- [ ] `src/tms/types.ts` — DTO de booking, command input, resultado interno con booking ref/timestamp y modelo público sin `maxBuy`.
- [ ] `src/tms/http.ts` o validator dedicado — valida `loadId`, `mcNumber`, `agreedRate` y mapea nombres públicos.
- [ ] `src/tms/service.ts` o módulo de aplicación enfocado — operación `bookLoad`, sin construir framing ni manejar sockets directamente.
- [ ] `src/tms/protocol.ts` — mapping exacto a `LOAD_BOOK`, `LOAD_ID`, `MC_NUM`, `AGREED_RATE`.
- [ ] `mock/dataset.ts` — estado mutable aislado por instancia de mock; carga disponible y estados booked.
- [ ] `mock/ltms-server.ts`/`mock/scenarios.ts` — transición y errores stateful: already booked, unknown load, invalid rate, auth/server errors.
- [ ] `tests/tms/booking.test.ts`, `routes.test.ts`, `integration.test.ts` — reserva, seguridad, concurrencia/teardown y regresiones.
- [ ] `README.md` — actualizar uso local de booking, advertencia de timeout incierto y seguridad; ampliar completamente en 1D.

## Module Boundaries / Contracts

- [ ] `POST /api/tms/loads/book` acepta exactamente `{ "loadId": string, "mcNumber": string, "agreedRate": string | number }`; faltantes, tipos inválidos, framing o tarifa no válida producen error seguro.
- [ ] Mapping exacto: `loadId → LOAD_ID`, `mcNumber → MC_NUM`, `agreedRate → AGREED_RATE` en command `LOAD_BOOK`; no aceptar `mcNum` como sustituto público.
- [ ] El servicio recibe DTO validado y devuelve resultado público de booking; no conoce detalles de HTTP ni crea requests fuera de `protocol.ts`.
- [ ] El mock mantiene estado por instancia/test: carga disponible → `BOOKED`, genera booking reference y timestamp UTC, y devuelve resultado estable sin exponer `MAX_BUY`.
- [ ] Casos remotos mínimos: already booked, unknown load, invalid rate, `AUTH_FAILED` y `SERVER_ERROR`, además de success.
- [ ] Una reserva exitosa no se repite por retry automático. Un timeout de booking deja el resultado incierto: el cliente no debe asumir éxito ni ejecutar una segunda reserva automáticamente.
- [ ] Status mapping conserva 401 auth, 404 unknown load, 409 already booked, 422 invalid rate, 502 upstream/server, 504 timeout y envelope seguro; no stack, token, secreto ni MAX_BUY.
- [ ] La lectura de `MAX_BUY` puede usarse internamente para validar una tarifa en el mock, pero no se implementa negociación completa ni se devuelve el umbral.
- [ ] Estado compartido se protege mediante aislamiento por servidor/test y control de concurrencia razonable; no se exige persistencia real.

## Extraction Plan

- [ ] Separar validación/mapping HTTP de la transición de estado y de la serialización wire.
- [ ] Encapsular la máquina `AVAILABLE → BOOKED`, booking ref y timestamp en dataset/state module; no ponerla en route o parser.
- [ ] Centralizar normalización de rate, límites, códigos remotos y status mapping.
- [ ] Mantener el cliente agnóstico a booking salvo la regla transversal de no retry y resultado incierto.
- [ ] Mantener metadata de logs segura: command, request id, duration, outcome, error type/remote code, sin IDs sensibles completos si la política los considera sensibles.

## Modularity Risks

- [ ] No convertir `service.ts` en un módulo que haga HTTP, dominio, TCP, timers y logging.
- [ ] No mutar el dataset global entre tests; cada mock debe tener estado aislado y teardown determinista.
- [ ] No hacer que un timeout dispare retry silencioso ni una consulta automática que falsee el resultado.
- [ ] No usar `MAX_BUY` para introducir negociación completa o leakage público.
- [ ] No romper los dos endpoints read-only al introducir el estado mutable.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] No aplica Visual Fidelity. No usar Figma, no crear UI y no realizar revisión visual.

## Technical Approach

1. Congelar y probar regresión de 1A/1B.
2. Añadir DTO y mapping de `LOAD_BOOK`.
3. Encapsular estado del mock y sus transiciones/error cases.
4. Conectar servicio/handler al cliente existente sin modificar lifecycle seguro.
5. Probar éxito, conflictos, errores, concurrencia razonable y timeout sin retry.

## Implementation Steps

1. Confirmar los gates 1A/1B y ejecutar sus suites antes de tocar dataset o service.
2. Añadir tipos y validator de booking para `loadId`, `mcNumber` y `agreedRate`; normalizar la tarifa según contrato y rechazar valores inválidos.
3. Extender `protocol.ts` con `LOAD_BOOK`, `LOAD_ID`, `MC_NUM`, `AGREED_RATE`, manteniendo CMD primero, AUTH obligatorio, values seguros, CRLF y límites.
4. Extraer la transición stateful del mock: available→BOOKED, booking ref, timestamp UTC; aislar estado por instancia y preparar teardown/concurrency razonable.
5. Implementar respuestas remotas de already booked, unknown load, invalid rate, auth/server error, y asegurar que faults/error paths no mutan estado salvo success explícito.
6. Añadir `bookLoad` enfocado y `app/api/tms/loads/book/route.ts`; conservar mappers públicos sin `MAX_BUY` y envelopes/status mapping centralizados.
7. Verificar cliente: una conexión/request, no retry de booking, timeout que rechaza como incierto sin segunda operación y cleanup completo.
8. Añadir tests unitarios de mapping/state, route tests de seguridad y integration TCP con aislamiento, dos reservas y concurrencia razonable.
9. Actualizar README incrementalmente y ejecutar regresión, typecheck, test, build/lint si configurados.

## Edge Cases

- [ ] Body inválido, campos faltantes, `mcNumber` vacío, `loadId` desconocido, `agreedRate` cero/negativo/no numérico/fuera de límites y valores con framing.
- [ ] Primera reserva exitosa cambia exactamente a BOOKED; segunda reserva devuelve already booked y no genera otra ref.
- [ ] Booking concurrente del mismo load produce como máximo una transición exitosa y un resultado de conflicto/error determinista.
- [ ] Timeout/no response después de enviar puede dejar estado remoto incierto; no reintentar ni afirmar BOOKED localmente sin confirmación.
- [ ] `AUTH_FAILED`, `SERVER_ERROR`, `UNKNOWN_LOAD`, `INVALID_RATE` y errores de socket conservan type/code/status/envelope seguros.
- [ ] Timestamp del booking es UTC; booking ref no filtra token, MAX_BUY ni información no pública.
- [ ] Cerrar servidor/mock y limpiar sockets/timers aun cuando el booking falle o haya eventos concurrentes.

## Verification Plan

- [ ] Tests de protocol/HTTP verifican body exacto y mapping `LOAD_ID`/`MC_NUM`/`AGREED_RATE`.
- [ ] Tests de state module verifican available→BOOKED, ref, timestamp UTC, already booked, unknown load e invalid rate, con estado aislado.
- [ ] Route tests verifican success, 400/401/404/409/422/502/504, envelope, no stack/secrets/MAX_BUY y no aceptación de `mcNum`.
- [ ] Integration TCP verifica auth/server errors, una conexión/request, success único, segunda reserva conflictiva, aislamiento entre instancias y teardown.
- [ ] Client tests verifican timeout de booking, settle único, no retry automático y ausencia de handles abiertos.
- [ ] Ejecutar regresión completa de 1A/1B, `typecheck`, `test`, `build` y `lint` si configurados; nunca red externa.

## Rollback Plan

- [ ] Revertir solo handler, DTO/mapping, servicio booking, estado/mock y tests de 1C; dejar 1A/1B read-only operativas.
- [ ] Si hay ambigüedad de tarifa, congelar el contrato de validación y no exponer `MAX_BUY` ni agregar negociación.
- [ ] Ante problemas de concurrencia, deshabilitar el escenario de booking y conservar dataset read-only hasta resolver el aislamiento.

## Acceptance Criteria

- [ ] Se añade únicamente `POST /api/tms/loads/book` con body `{loadId, mcNumber, agreedRate}` y mapping exacto `LOAD_ID`, `MC_NUM`, `AGREED_RATE`.
- [ ] El mock stateful implementa disponible→BOOKED, booking ref/timestamp UTC, already booked, unknown load, invalid rate, auth/server errors.
- [ ] Estado se aísla por mock/test, teardown es razonable y concurrencia no permite doble booking exitoso.
- [ ] No hay retry automático; timeout de booking se trata como resultado incierto.
- [ ] `MAX_BUY` sigue internal-only; no existe negociación completa ni exposición pública.
- [ ] Tests de reserva, seguridad, lifecycle, no retry y regresión read-only pasan con mock local y sin red externa.
