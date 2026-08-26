# Phase 1D — Protocol Hardening and Fault-injection Specification

## Context

Esta fase depende de 1C aprobado y es el cierre de la implementación local del adaptador. No añade nuevos endpoints: endurece todos los contratos acumulados, completa fault injection configurable, cubre carreras de lifecycle y deja documentación y verificación final. No implementa TMS real, FMCSA, HappyRobot, deployment ni `node:tls`; solo deja el seam preparado para una futura implementación TLS.

No aplica Visual Fidelity: no hay UI, Figma, maquetación ni Playwright visual.

## Dependencies / Inputs

- [ ] Gates 1A, 1B y 1C aprobados y regresión disponible.
- [ ] Contratos acumulados de `DEBUG_ECHO`, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, envelopes, errores, seguridad y no retry.
- [ ] Mock local, puertos efímeros, fake timers donde sean útiles y ningún acceso a red externa.
- [ ] README existente para ampliar hasta documentación final de operación local, arquitectura, decisiones, límites, fallos probados y futuras integraciones no implementadas.

## Files / Modules

- [ ] `src/tms/protocol.ts` — validación exhaustiva de commands/fields/values, framing, byte limits y builder seguro.
- [ ] `src/tms/parser.ts` — máquina incremental completa de request/response, límites, terminales, metadata raw segura y errores estructurados.
- [ ] `src/tms/transport.ts` — puerto de transporte compatible con implementación futura `node:tls`, sin implementar TLS.
- [ ] `src/tms/client.ts` — lifecycle robusto ante error/close/end/timeout, settle único, timers/listeners/socket cleanup y no handles.
- [ ] `src/tms/errors.ts`, `src/tms/http.ts`, `src/tms/logger.ts` — mapping/logging seguro, estable y exhaustivo.
- [ ] `mock/ltms-server.ts`, `mock/scenarios.ts`, `mock/cli.ts` — fault injection configurable, fragmentation, delayed END, puertos y teardown.
- [ ] `tests/tms/protocol.test.ts`, `parser.test.ts`, `client.test.ts`, `routes.test.ts`, `integration.test.ts` y matrix helpers — cobertura integral sin tests dependientes de sleeps.
- [ ] `README.md` — documentación final ampliada por el ejecutor.

## Module Boundaries / Contracts

- [ ] El builder valida exhaustivamente identificadores, fields reservados, values, CR/LF/`|`, UTF-8 y request byte limit; mantiene `CMD` primero, `AUTH` obligatorio y CRLF, sin allowlist semántica que bloquee `UNKNOWN_CMD` sintáctico.
- [ ] El parser opera incrementalmente con `Buffer` y valida CRLF estricto, CR/LF aislado, líneas/campos inválidos, fields duplicados/reservados según contrato, values/framing ilegales, padding permitido, límites request/response y bytes/chunks arbitrarios.
- [ ] El parser acepta records múltiples en cualquier orden y `END\r\n` vacío o tras records; acepta ERR terminal estructurado; rechaza trailing/unknown terminal, response parcial no exitosa, EOF prematuro, partial sin END y exceso de límites.
- [ ] Raw line/metadata solo se preserva internamente y redactada/limitada; nunca contiene token, secretos, MAX_BUY, stack, wire completo ni NOTES completa en superficies públicas.
- [ ] El cliente distingue carreras `error`/`close`/`end`/timeout, resuelve/rechaza una sola vez, limpia timers/listeners/sockets, cierra siempre y no deja handles abiertos. No hace retries, especialmente para booking.
- [ ] El seam de transporte expresa connect/write/data/end/error/close y soporta sustituir `node:net` por un futuro `node:tls`, pero TLS no se implementa ni se documenta como disponible.
- [ ] El mock permite fault injection configurable: timeout/no response, partial sin END, malformed, invalid framing, delayed END, fragmentation, server error y todos los códigos remotos (`AUTH_FAILED`, `UNKNOWN_CMD`, `MISSING_FIELD`, `UNKNOWN_LOAD`, `ALREADY_BOOKED`, `INVALID_RATE`, `SERVER_ERROR`), sin mutación accidental del booking.
- [ ] Todos los endpoints conservan shapes, statuses, envelopes, filtering de MAX_BUY y logging seguro establecidos en 1A–1C.

## Extraction Plan

- [ ] Separar validadores de framing, byte counters, line decoder, record parser y terminal classifier dentro de `protocol.ts`/`parser.ts` sin crear una clase monolítica.
- [ ] Separar state machine de fault scenarios del servidor TCP; escenarios deben ser datos/configuración testeables.
- [ ] Separar lifecycle/settle/cleanup del mapping de errores y del logger en cliente.
- [ ] Centralizar límites, códigos, terminales, status mapping, redactions y formatting.
- [ ] Mantener helpers de matrix y factories de puertos efímeros fuera de los módulos productivos.

## Modularity Risks

- [ ] No convertir el parser en un dispatcher de negocio ni el mock en una copia del cliente productivo.
- [ ] No resolver carreras agregando handlers ad hoc que provoquen doble settle o listeners filtrados.
- [ ] No probar timeouts mediante sleeps frágiles cuando fake timers o seams sean suficientes.
- [ ] No hacer que fault injection modifique implícitamente el estado de booking; solo success explícito puede hacerlo.
- [ ] No conservar raw response ilimitada ni incluir metadata insegura en errores HTTP/logs.
- [ ] No implementar TLS, integración real, deployment o negociación completa como parte de hardening local.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] No aplica Visual Fidelity. No usar Figma, no crear UI y no realizar revisión visual.

## Technical Approach

1. Auditar contratos 1A–1C y congelar compatibilidad pública.
2. Endurecer builder/parser y límites con pruebas de framing.
3. Endurecer cliente/transport lifecycle y seam futuro TLS.
4. Añadir escenarios configurables de fault injection al mock.
5. Ejecutar matriz completa de unidades, routes e integración TCP local.
6. Completar logging/errors/HTTP mapping, README y gates finales.

## Implementation Steps

1. Ejecutar la regresión de 1A–1C y registrar cualquier incompatibilidad antes de modificar shared modules.
2. Completar `protocol.ts` con validación de framing, CR/LF aislado, campos/nombres/values, byte limits, CRLF, campos reservados y command desconocido sintácticamente válido.
3. Completar `parser.ts` con Buffer incremental, líneas divididas, records/fields, terminal classifier, END/ERR, trailing/unknown terminal, límites, padding seguro, raw metadata limitada y EOF prematuro.
4. Extender `transport.ts` con el seam mínimo para un futuro `node:tls` y mantener la implementación actual en `node:net`.
5. Reforzar `client.ts` contra todas las carreras error/close/end/timeout: settle único, timers/listeners/sockets limpiados, cierre garantizado, no retry y ausencia de handles abiertos.
6. Implementar configuración de escenarios del mock para timeout/no response, partial sin END, malformed, invalid framing, delayed END, fragmentation, server error y todos los remote codes; asegurar teardown y no mutación accidental.
7. Completar errores tipados, HTTP mapping, logging/redaction y preservación segura de metadata raw; verificar que MAX_BUY/NOTES/secrets nunca crucen fronteras.
8. Crear la comprehensive test matrix de builder/parser/client/routes/integration: bytes/chunks arbitrarios, fake timers, puertos efímeros, cada endpoint, cada fallo y regresiones.
9. Ejecutar `typecheck`, `build`, `test`, `lint` y smoke HTTP local sin red externa; corregir handles abiertos, filtraciones y doble settle.
10. Ampliar README final con instalación, env, `dev`, `mock:tms`, comandos/curl, arquitectura modular, límites, errores, fault scenarios, decisiones, seguridad, pruebas y notas de que TMS real/TLS/deployment quedan fuera.

## Edge Cases

- [ ] CR y LF aislados, CRLF partido en cualquier frontera de chunk, bytes arbitrarios, línea sin CRLF, campo sin `:`, campo vacío/duplicado, value con framing ilegal.
- [ ] `END` con trailing bytes, terminal desconocido, ERR incompleto/duplicado, response vacía válida, records válidos seguidos de EOF, partial no exitosa y payload sobre límite.
- [ ] Faults de timeout/no response, partial sin END, malformed, invalid framing, delayed END y fragmentation en cualquier command.
- [ ] `error` seguido de `close`, `end` seguido de `close`, timeout seguido de data/error, connect error y doble terminal; todos deben producir una sola decisión y cleanup.
- [ ] Server error y todos los remote codes conservan code estructurado y mapping seguro; códigos desconocidos no se vuelven genéricos sin perder su código seguro.
- [ ] Booking fault/timeout no reintenta ni muta localmente de forma no confirmada; success explícito mantiene transición única.
- [ ] Puertos efímeros, cierre durante tests, ejecución concurrente razonable y cero handles abiertos al finalizar.
- [ ] Logs/HTTP/errors no contienen token, secretos, wire completo, stack, MAX_BUY, NOTES completa ni metadata raw ilimitada.

## Verification Plan

- [ ] **Builder matrix:** command/field/value válidos e inválidos, reserved fields, CR/LF/pipe, UTF-8 bytes, request limits, CMD/AUTH/CRLF, unknown command sintáctico.
- [ ] **Parser matrix:** chunks de uno o varios bytes, todos los cortes de CRLF/END/ERR, records múltiples/order independiente, padding/formatting, empty response, malformed/framing/trailing/EOF/limit/unknown terminals.
- [ ] **Client matrix:** connect/response timeouts, socket error, close/end/error races, delayed END, partial, fragmentation, settle único, cleanup idempotente, no retries y no open handles; fake timers donde sea útil.
- [ ] **Routes matrix:** DTOs de echo/search/detail/book, JSON inválido, status 400/401/404/409/422/502/503/504/500 seguro, envelopes, MAX_BUY/secrets/stack y logs redactados.
- [ ] **Integration matrix:** mock TCP real en puertos efímeros, cada command, todos los códigos remotos, cada fault scenario, sockets nuevos, booking concurrency/teardown y sin red externa.
- [ ] Verificar typecheck, build, test y lint; revisar no imports browser de server-only config y ausencia de `NEXT_PUBLIC_*`.
- [ ] Verificar README final contra el comportamiento real y señalar explícitamente no implementación de TMS real, FMCSA, HappyRobot, TLS y deployment.

## Rollback Plan

- [ ] Revertir hardening/fault scenarios/test matrix/documentación de 1D y conservar el último baseline 1C aprobado.
- [ ] Si una validación exhaustiva contradice una hipótesis de handbook, detener el cambio de contrato, conservar comportamiento anterior y registrar la decisión para una revisión explícita.
- [ ] No degradar silenciosamente límites, seguridad, cleanup o no-retry para hacer pasar una prueba.

## Acceptance Criteria

- [ ] Builder/parser validan exhaustivamente framing, CR/LF, líneas/campos, límites, chunks/bytes arbitrarios, terminales, EOF y respuestas parciales según esta spec.
- [ ] Raw metadata es limitada y segura; nunca se filtran token, secretos, wire completo, stack, MAX_BUY o NOTES completa.
- [ ] Mock configurable cubre timeout/no response, partial sin END, malformed, invalid framing, delayed END, fragmentation, server error y todos los códigos remotos.
- [ ] Cliente soporta carreras error/close/end/timeout con settle único, cleanup completo, timers/socket/listeners limpios, cero handles abiertos y no retry.
- [ ] Seam para futuro `node:tls` existe sin implementar `node:tls`.
- [ ] Comprehensive matrix cubre builder/parser/client/routes/integration con puertos efímeros, fake timers donde útil y sin red externa.
- [ ] HTTP mapping, errores, logging y README final están ampliados, seguros y consistentes con 1A–1C.
- [ ] `typecheck`, `build`, `test` y `lint` pasan; no se añade UI, TMS real/FMCSA/HappyRobot, deployment ni negociación completa.
