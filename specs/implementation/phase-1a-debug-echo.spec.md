# Phase 1A — Minimal DEBUG_ECHO Vertical Slice Specification

## Context

El repositorio está completamente vacío: no existen `package.json`, lockfile, código, configuración ni tests. Esta fase crea únicamente el vertical slice mínimo para probar `DEBUG_ECHO` de extremo a extremo:

`POST /api/tms/echo → cliente TCP → mock TCP local`.

Es el checkpoint actual. Debe ser deliberadamente pequeño: no se crean otros route handlers, dataset completo, booking, fault injection configurable ni una service/domain layer compleja. No se debe crear un módulo god ni abstraer service/domain innecesariamente.

No aplica Visual Fidelity: no hay UI, Figma, maquetación ni Playwright visual.

## Dependencies / Inputs

- [ ] Node.js compatible con Next.js App Router y `node:net`.
- [ ] Next.js App Router + TypeScript estricto + Vitest en entorno Node.
- [ ] Dependencias mínimas; `tsx` solo como dev dependency si es imprescindible para `mock:tms`.
- [ ] No usar `NEXT_PUBLIC_*`, secretos hardcodeados ni red externa.
- [ ] `.env.example` debe documentar configuración no secreta/placeholder.
- [ ] Debe dejarse README mínimo (creado por el ejecutor, no por este spec-writer) con instalación, configuración, levantamiento de Next/mock, tests y `curl`; la documentación ampliada queda para 1D o se actualiza incrementalmente.

## Files / Modules

- [ ] `package.json`, lockfile y configuración mínima de Next/TypeScript/Vitest — bootstrap y scripts `dev`, `build`, `start`, `test`, `test:watch`, `mock:tms`, `typecheck` y `lint` si el stack lo soporta.
- [ ] `app/api/tms/echo/route.ts` — único Route Handler de esta fase; exporta `runtime = "nodejs"`, parsea/delega/formatea y no conoce TCP ni framing.
- [ ] `src/tms/config.ts` — módulo server-only para `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN`, `TMS_CONNECT_TIMEOUT_MS`, `TMS_RESPONSE_TIMEOUT_MS`, `TMS_MAX_FRAME_BYTES`; default de límite 4096; no expone secretos.
- [ ] `src/tms/protocol.ts` — builder puro de requests `DEBUG_ECHO` con `CMD` primero, `AUTH` obligatorio, `MSG` y CRLF.
- [ ] `src/tms/parser.ts` — parser incremental independiente del socket, basado en `Buffer`, para records básicos, `END` y `ERR` básico.
- [ ] `src/tms/transport.ts` — puerto pequeño para conectar/escribir/recibir/cerrar, con implementación `node:net` y seam de tests.
- [ ] `src/tms/client.ts` — una conexión nueva por llamada, una request, timers, acumulación de chunks, terminal detection y cleanup idempotente.
- [ ] `src/tms/errors.ts` — errores estructurados mínimos: connection, timeout, protocol/incomplete, remote, validation y configuration.
- [ ] `src/tms/logger.ts` — logging seguro mínimo con command, request id, duración, outcome, error type, remote code y record count.
- [ ] `mock/ltms-server.ts` — mock TCP local de una request por conexión, happy path `DEBUG_ECHO` y `ERR` básico, por ejemplo auth inválida.
- [ ] `mock/cli.ts` — `mock:tms`, host/port configurables, incluido port `0`, salida del puerto efectivo y teardown limpio.
- [ ] `tests/tms/protocol.test.ts` — builder y validación.
- [ ] `tests/tms/parser.test.ts` — fragmentación, terminales, records básicos y errores básicos.
- [ ] `tests/tms/client.test.ts` — seam o TCP real, timeouts, cleanup y no reuse.
- [ ] `tests/tms/routes.test.ts` — route directa/integration, shape, status, envelope y seguridad.
- [ ] `README.md` — documentación mínima solicitada; no añadir documentación extensa de 1B–1D en este checkpoint.

## Module Boundaries / Contracts

- [ ] El handler acepta solo JSON con body exacto `{ "message": string }`; rechaza JSON inválido, campos faltantes, tipo incorrecto y message vacío según una validación estable. No acepta un wrapper alternativo.
- [ ] El handler delega a una función pequeña del cliente; no crea `service.ts` ni una capa domain genérica salvo una necesidad concreta y justificada por el contrato de 1A.
- [ ] `protocol.ts` genera exactamente `CMD:DEBUG_ECHO|AUTH:<token>|MSG:<message>\r\n` (con encoding UTF-8), en ese orden. `CMD` y `AUTH` no son campos de usuario.
- [ ] Command y field son identificadores ASCII no vacíos con sintaxis centralizada; no usar allowlist semántica rígida: el builder debe poder representar un command desconocido sintácticamente válido para pruebas futuras, aunque el route solo use `DEBUG_ECHO`.
- [ ] Values no pueden contener `|`, `\r` ni `\n`; el builder cuenta bytes incluyendo CRLF, aplica `TMS_MAX_FRAME_BYTES` (default 4096), rechaza exceso y nunca trunca.
- [ ] `parser.ts` acepta chunks `Buffer` arbitrarios, records `FIELD:VALUE|...\r\n`, names/values con padding ASCII externo y orden no relevante; admite `END\r\n` separado o dividido y `END\r\n` sin records.
- [ ] El parser admite `ERR|CODE:<code>|MSG:<message>\r\n` como terminal remoto básico, conserva códigos desconocidos estructuradamente y valida CODE/MSG presentes. No exige END después de ERR.
- [ ] En 1A no se exige todavía la matriz completa de framing inválido, padding exhaustivo ni records de negocio; sí se debe detectar EOF antes de `END`/`ERR` válido y no tratar un parcial como éxito.
- [ ] `client.ts` usa `node:net`, host/port de config, conexión nueva por request, una sola escritura/request, connect timeout y response timeout configurables, acumulación de `Buffer`, cierre siempre y cleanup idempotente. No retries.
- [ ] Los errores exponen al menos `type`, `code`, `message`, `retryable`, `stage` y metadata segura opcional. El envelope HTTP es `{ "ok": true, "data": ... }` o `{ "ok": false, "error": { "type": string, "code": string, "message": string, "retryable": boolean } }`, sin stack.
- [ ] El mock acepta host/port configurables, procesa una request por socket, responde solo happy path `DEBUG_ECHO` o ERR básico como `AUTH_FAILED`, y no incluye dataset, booking ni fault injection configurable.
- [ ] El logger nunca registra token, wire completo, secretos, stack, `MAX_BUY` o `NOTES`; en esta fase solo deben existir los campos seguros definidos.

## Extraction Plan

- [ ] Mantener el builder y validadores de bytes como funciones puras en `protocol.ts`.
- [ ] Mantener máquina de estados y buffer pendiente en `parser.ts`, sin referencias al socket.
- [ ] Mantener IO, timers, listeners y cierre en `transport.ts`/`client.ts`.
- [ ] Mantener parsing HTTP/envelope dentro del handler o helper pequeño de 1A; no introducir service/domain layer futura.
- [ ] Centralizar nombres de variables, defaults, límite 4096, códigos básicos y status mapping.
- [ ] Usar logger seguro único; no dispersar `console.log` con datos wire.

## Modularity Risks

- [ ] **God module:** no combinar route, codec, parser, TCP, timers, errores y logging en `route.ts` o `client.ts`.
- [ ] **Sobre-abstracción:** no crear repositorios, domain services, mappers de cargas ni interfaces de booking todavía.
- [ ] **Scope creep:** no crear `/loads/search`, `/loads/detail`, `/loads/book`, dataset completo ni escenarios configurables de faults.
- [ ] **Framing inseguro:** no resolver delimitación concatenando strings; usar `Buffer` incremental.
- [ ] **Secret leakage:** no devolver ni registrar `AUTH_TOKEN` ni el wire completo.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] No aplica Visual Fidelity. No usar Figma, no crear UI y no realizar revisión visual.

## Technical Approach

1. Bootstrap mínimo sin UI.
2. Validar configuración server-only y construir errores seguros.
3. Implementar builder y parser básicos como unidades puras.
4. Implementar transporte TCP y cliente de una conexión/request.
5. Implementar el único handler echo, mock local y logging mínimo.
6. Probar por capas y cerrar con smoke local/documentación mínima.

## Implementation Steps

1. Crear la base Next.js App Router, TypeScript estricto, Vitest Node y dependencias/scripts mínimos; no añadir UI.
2. Crear `.env.example` y `src/tms/config.ts`. Validar presencia/tipos/rangos de `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN`, timeouts y `TMS_MAX_FRAME_BYTES`; usar 4096 por defecto y fallar como configuración segura.
3. Crear `src/tms/errors.ts` y `logger.ts` con categorías mínimas y redacción estricta.
4. Implementar `protocol.ts`: `DEBUG_ECHO`, `MSG`, `CMD` primero, `AUTH` segundo/obligatorio, fields, prohibición de `|`/CR/LF, UTF-8, CRLF, límite de request bytes y sin allowlist semántica rígida.
5. Implementar `parser.ts` incremental con `Buffer`, records básicos, `END`, `ERR`, END separado/división de líneas, respuesta vacía y EOF incompleto; no añadir aún la matriz exhaustiva de 1D.
6. Implementar `transport.ts` con `node:net` y seam mínimo; implementar `client.ts` con conexión nueva, una request, timers separados, acumulación de chunks, settle único, cleanup idempotente y cierre siempre.
7. Implementar únicamente `app/api/tms/echo/route.ts` con `runtime = "nodejs"`, validación exacta de `{message}`, delegación al cliente y envelope estable.
8. Implementar `mock/ltms-server.ts` y `mock/cli.ts` para happy path y ERR de auth inválida, host/port configurables, port `0` y teardown limpio.
9. Añadir tests de builder, parser con fragmentación/END/ERR, cliente TCP real o seam con timeout/cleanup, route directa/integration y socket nuevo/no reuse; comprobar ausencia de secretos.
10. Ejecutar typecheck, test y smoke HTTP local; crear README mínimo con instalación, env, `dev`, `mock:tms`, test y `curl`. No documentar como completadas las capacidades de 1B–1D.

## Edge Cases

- [ ] Body no JSON, body vacío, `message` ausente, no string, string vacío, caracteres UTF-8 y message con `|`/CR/LF.
- [ ] Token vacío, puerto inválido, host ausente, timeout inválido y frame que excede 4096 bytes sin truncarse.
- [ ] Chunks de un byte, línea/CRLF dividido, `END` en chunk separado, `END\r\n` sin records, múltiples records básicos y respuesta que termina exactamente en CRLF.
- [ ] `ERR` con CODE/MSG, código desconocido estructurado, ERR malformado, respuesta vacía real, EOF antes de terminal y close prematuro.
- [ ] Socket error durante connect/response, connect timeout, response timeout, delayed/no response en seam, doble evento y cleanup repetido.
- [ ] Dos llamadas consecutivas abren dos sockets distintos; nunca se escribe una segunda request en el primero.
- [ ] Ningún response, log o error HTTP contiene token, wire completo, stack u otros secretos.

## Verification Plan

- [ ] `protocol.test.ts`: exactitud de `CMD`/`AUTH`/`MSG`/CRLF, UTF-8 y byte count, `|`/CR/LF inválidos, identifiers, `UNKNOWN_CMD` sintáctico y límite default/configurable.
- [ ] `parser.test.ts`: chunks arbitrarios, records básicos, padding externo, END dividido/separado, respuesta sin records, ERR básico/conocido/desconocido, EOF incompleto y rechazo de parciales.
- [ ] `client.test.ts`: connect/response timeout, error/close prematuro, settle único, cleanup idempotente, cierre, una request por socket, no retry y no reuse.
- [ ] `routes.test.ts`: POST directo o integration, validación del body exacto, success/error envelope, status de validation/remote/timeout/protocol/configuration y ausencia de stack/secrets.
- [ ] Levantar mock local en puerto configurable/efímero, ejecutar `curl` a `/api/tms/echo` y comprobar `message → MSG` y respuesta echo.
- [ ] Ejecutar `typecheck` y `test`; `build`/`lint` si ya están configurados sin ampliar el scope.
- [ ] Revisar que no exista UI, ningún import browser de configuración server-only y ninguna variable `NEXT_PUBLIC_*` para TMS.

## Rollback Plan

- [ ] Revertir únicamente bootstrap, configuración, módulos, mock, tests y documentación creados para 1A; conservar las `.spec.md`.
- [ ] Si falla el mock o el transporte, volver al seam de tests y no introducir retries, pooling, TLS ni rutas de fases posteriores.
- [ ] Si una decisión de framing requiere cambio, mantener el contrato documentado y posponer hardening exhaustivo a 1D.

## Acceptance Criteria

- [ ] El repo arranca con Next.js App Router + TypeScript estricto + Vitest Node y dependencia mínima, sin UI.
- [ ] Existe solo `app/api/tms/echo/route.ts` como route handler y declara `export const runtime = "nodejs"`.
- [ ] `{ "message": string }` se valida y llega exactamente como `DEBUG_ECHO` con `MSG`.
- [ ] Configuración server-only cubre todas las variables `TMS_*`, default 4096, `.env.example` y ausencia de `NEXT_PUBLIC_*`/secret leakage.
- [ ] Builder y parser cumplen los contratos básicos de CMD/AUTH/fields/values/CRLF/Buffer/END/ERR/EOF descritos, sin pretender la matriz completa de 1D.
- [ ] Cliente `node:net` crea un socket por request, tiene timeouts configurables, cleanup idempotente, cierre garantizado y no retries.
- [ ] Errores mínimos y envelope HTTP son estructurados, estables y sin stack.
- [ ] Mock configurable soporta únicamente happy path DEBUG_ECHO y ERR básico, sin dataset, booking ni fault injection configurable.
- [ ] Tests esenciales verifican builder, parser, cliente, route, timeout/cleanup, socket nuevo/no reuse y ausencia de secretos.
- [ ] README mínimo queda creado por el ejecutor con instalación, configuración, levantar Next/mock, tests y `curl`.
- [ ] No se crea un módulo god ni una abstracción service/domain innecesaria.
