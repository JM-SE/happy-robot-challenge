# Phase 2A — Real DEBUG_ECHO Validation Implementation Specification

## Context

Este es el handoff execution-ready para `@coder-heavy`. Esta tarea crea únicamente este archivo; las rutas de código, tests, scripts, README, fixtures y reportes listadas abajo son objetivos de implementación posterior y no se modifican ahora.

Phase 1A–1D es el baseline local ya implementado: `Route Handler Node → node:net → mock LTMS`, con `DEBUG_ECHO`, cargas, booking, parser incremental, límites, errores seguros, cleanup y tests locales. Phase 2A agrega solo la validación opt-in contra el candidate TMS no productivo autorizado, sin sustituir el mock ni abrir capacidades operativas.

La fuente de verdad del protocolo real es `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`, contrastada con evidencia observada. Host, port y token reales se obtienen exclusivamente por configuración server-only fuera del chat, del repositorio y de cualquier artefacto. Nunca se hardcodean, imprimen, registran ni persisten.

Alcance exclusivo: guard/configuración real fail-closed, TCP directo opt-in, `DEBUG_ECHO`, framing/auth/ASCII/CRLF, parser y mapper compatibles, lifecycle/timeouts/cleanup, runner real aislado, evidencia sanitizada, comparación handbook ↔ real ↔ mock y regresión local de Phase 1.

No se autoriza `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, booking real, HappyRobot, FMCSA, voice, deployment, OAuth, persistencia, pooling, retries, TLS, túneles públicos, endpoints nuevos ni ejecución real desde `npm test`.

## Dependencies / Inputs

- [x] `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT` (`HR-LTMS-PR-001`): TCP directo, encoding ASCII, CRLF, request máxima de 4096 bytes incluyendo terminador, server idle timeout de 30 s, una request por conexión y cierre del servidor después de respuesta o error.
- [x] Contrato oficial de 2A: request `CMD:<command>|AUTH:<token>|<FIELD>:<VALUE>|...\r\n`; `CMD` primero, `AUTH` obligatorio, nombres uppercase, values sin `|`, CR o LF, fields desconocidos aceptados y descartados, y chunks tratados como byte stream.
- [x] Contrato oficial de respuesta: éxito con records y `END\r\n` obligatorio; una respuesta exitosa sin `END` es incompleta; error `ERR|CODE:<code>|MSG:<message>\r\n`; códigos no conocidos se conservan estructuradamente.
- [x] Autorización explícita para ejecutar únicamente `DEBUG_ECHO` contra la instancia candidate no productiva por TCP directo. `DEBUG_ECHO` no tiene side effects y bypasses fault injection; una respuesta exitosa no prueba comandos operativos ni fault injection real.
- [x] Activation guard aceptado: `TMS_MODE=real` + `TMS_ENV=non-production` + `TMS_REAL_ENABLED=true`, allowlist exclusiva `DEBUG_ECHO`, runner separado y mock como default.
- [x] Baseline actual y specs de Phase 1/Phase 2, especialmente `specs/implementation/phase-2-index.spec.md`.
- [x] Valores reales de `TMS_HOST`, `TMS_PORT` y `TMS_AUTH_TOKEN` configurados por el usuario por un canal autorizado y fuera de los artefactos antes del check real. No inventar valores ni incluirlos aquí.
- [ ] La implementación debe mantener la compatibilidad de Node/Next/Vitest ya existente y no introducir una dependencia de configuración que exponga secretos al bundle del navegador.

## Files / Modules

- [ ] `src/tms/config.ts` — leer configuración exclusivamente server-side; resolver mock por defecto o real opt-in; validar host, port, token, timeouts y límite; devolver errores seguros sin valores sensibles.
- [ ] `src/tms/policy.ts` o módulo interno equivalente — centralizar el activation guard y `DEBUG_ECHO` allowlist; rechazar comandos operativos en real antes de abrir o escribir en un socket. No duplicar la política en routes, tests y client.
- [ ] `src/tms/types.ts` — representar el modo/contrato interno y un `TmsRecord` con marker opcional (`recordType` o equivalente) sin romper el shape local de Phase 1.
- [ ] `src/tms/protocol.ts` — conservar builder puro de request, separación de reglas de request, orden `CMD`/`AUTH`, CRLF y conteo de bytes; limitar el request real a 4096 bytes incluyendo CRLF.
- [ ] `src/tms/parser.ts` — parser incremental puro/testeable para records con fields, marker bare `ECHO`, `AUTH` de response, `END`, `ERR`, fragmentación, EOF y trailing bytes.
- [ ] `src/tms/transport.ts` / `src/tms/client.ts` — IO TCP, una conexión/request, timers, listeners, cierre y cleanup; no mezclar evidencia ni reglas de negocio.
- [ ] `src/tms/echo.ts` — mapper estricto de los dos shapes validados hacia el contrato público estable `{ message, fieldCount }`.
- [ ] `src/tms/errors.ts` / `src/tms/logger.ts` — conservar clasificación y redacción seguras; `AUTH_FAILED`, configuración, timeout, protocolo e incompleto no deben revelar wire ni secretos.
- [ ] `app/api/tms/echo/route.ts` — conservar el endpoint público existente y su contrato; no agregar routes. Solo debe poder originar `DEBUG_ECHO`.
- [ ] `tests/tms/real/echo.test.ts` — suite real aislada, explícitamente guardada, ASCII-only, sin valores reales en código, sin retries, sin booking y con error claro si falta configuración.
- [ ] `tests/tms/real/fixtures/` o ubicación equivalente — solo fixtures sanitizadas y mínimas, si resultan necesarias; nunca capturas wire completas, tokens, PII, `MAX_BUY` o `NOTES` innecesarias.
- [ ] `vitest.config.ts` y, si se necesita para aislar el runner, `vitest.real.config.ts` — excluir `tests/tms/real/**` de la suite por defecto y permitir únicamente el comando explícito real.
- [ ] `package.json` — agregar un script explícito como `test:real-tms:echo`; `npm test` debe permanecer exclusivamente local.
- [ ] `README.md` y `.env.example` — documentar setup opt-in, guard, comandos, carga de env por PowerShell/Git Bash, sanitización, no-goals y mock default, sin valores reales.
- [ ] `reports/tms/phase-2a/` — reporte de evidencia y reconciliación sanitizado, separado del runtime y de los tests; crear/usar solo durante la ejecución autorizada.

## Module Boundaries / Contracts

### Activation guard y configuración

El guard debe ser centralizado, fail-closed y ejecutarse antes de `connectTcp` y antes de cualquier `write`:

1. **Default/mock:** si no se solicita real, el modo es mock/local. La ausencia de `TMS_ENV` y `TMS_REAL_ENABLED` no activa ni exige el track real. Se conserva la configuración local existente para el mock y sus seams de tests; no se infiere real por la presencia de un host.
2. **Real exacto:** solo se permite real cuando los tres valores crudos son exactamente `TMS_MODE=real`, `TMS_ENV=non-production` y `TMS_REAL_ENABLED=true`. No aceptar mayúsculas alternativas, espacios añadidos, valores truthy genéricos ni aliases.
3. **Target real:** en real son obligatorios `TMS_HOST`, `TMS_PORT` y `TMS_AUTH_TOKEN`, todos server-only; `TMS_PORT` debe ser entero entre 1 y 65535. Los timeouts existentes deben seguir siendo positivos y finitos. El límite efectivo del request real no puede exceder 4096 bytes incluyendo CRLF.
4. **Allowlist:** en real solo `DEBUG_ECHO` es permitido. `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK` y cualquier otro command se rechazan antes de conectar/escribir, sin fallback a mock y sin request parcial.
5. **No retry:** ni el guard, ni el client, ni el runner reintentan automáticamente. Un error o timeout termina esa única operación.
6. **Secreto cero:** no mostrar valores de host, port o token en logs, errores, fixtures, reportes, snapshots ni respuestas públicas. Pueden mencionarse nombres de variables de configuración sin incluir sus valores; preferiblemente no registrar host/port como metadata.
7. **Fail-closed:** flags faltantes, inválidos, contradictorios o configuración real incompleta producen un error seguro, no-retryable y claro, sin abrir socket. Nunca convertir silenciosamente un intento real inválido en una conexión mock ni viceversa.

La implementación puede conservar `getTmsConfig` o separar `resolveTmsRuntimeConfig` de `assertTmsCommandAllowed`, pero el resultado interno debe distinguir al menos `mock` y `real`; no debe exponer `authToken` fuera del runtime server-side. La política de flags no debe repartirse entre múltiples módulos.

### Request, auth y framing

- La forma wire oficial es `CMD:<command>|AUTH:<token>|<FIELD>:<VALUE>|...\r\n`, con `CMD` como primer segment y `AUTH` obligatorio como segundo segment. Names son uppercase ASCII; values no contienen `|`, `\r` ni `\n`.
- `protocol.ts` mantiene reglas de request separadas de las reglas de response: `CMD` y `AUTH` son reservados para el builder y no pueden entrar como fields de usuario; fields desconocidos, incluido `X`, `Y` o `Z`, pueden ser serializados si cumplen la sintaxis.
- El frame se construye en `Buffer`, termina exactamente en CRLF y cuenta bytes incluyendo el terminador. El límite oficial de request es 4096 bytes; aceptar el límite exacto y rechazar el byte siguiente sin truncar.
- El transporte real usa TCP directo, una request por conexión y no asume que un chunk equivale a una línea. El runner usa exclusivamente probes ASCII (`HELLO`, `X`, `Y`, `Z` y valores ASCII).
- La implementación actual basada en UTF-8 puede permanecer para no romper Phase 1: UTF-8 es byte-compatible para esos probes ASCII. No cambiar el encoding UTF-8 global ni inventar comportamiento, transliteración o política de caracteres no ASCII sin evidencia del TMS.

### Response parser y protocolo

- `parser.ts` permanece puro y recibe chunks `Buffer` arbitrarios. Debe reconocer CRLF estricto aunque marker, fields o `END` estén fragmentados entre chunks; no usar split por chunk.
- Un record local continúa siendo un conjunto `KEY:VALUE` y conserva el shape de Phase 1. Un record oficial puede comenzar con el marker bare `ECHO`, por ejemplo `ECHO|AUTH:OK|FIELDS_PARSED:3|MSG:HELLO`; `ECHO` se representa como `recordType`/equivalente y no como field `ECHO`.
- Para 2A se acepta explícitamente el marker `ECHO`; markers bare desconocidos, fields duplicados, nombres inválidos, LF aislado, CRLF inválido, values con framing o trailing bytes se rechazan. No agregar fallback que convierta cualquier línea malformada en echo.
- `AUTH` está reservado y prohibido como field de **request**, pero está permitido en **response** para validar el `AUTH:OK` oficial. Es un field no secreto en el contrato tipado; los diagnósticos raw, si existen internamente, deben redaccionar su value según la política segura.
- Un éxito solo es completo cuando existe `END\r\n`. Records sin `END`, EOF antes de `END`, cierre prematuro o timeout se clasifican como respuesta incompleta/transport error, nunca como éxito. `END` no puede tener bytes después.
- La respuesta de error es `ERR|CODE:<code>|MSG:<message>\r\n`. Se convierte en error remoto estructurado; el catálogo conocido no es exhaustivo y un code desconocido se conserva sanitizado. No incluir el `MSG` remoto en el error público si puede contener secretos.
- El parser no debe conocer sockets, HTTP, reportes ni reglas de negocio. `rawBytes` y `rawLine` solo pueden permanecer como diagnósticos acotados y redactados; nunca cruzan el boundary público.

### `DEBUG_ECHO` real y mapper público

- El único command real permitido no tiene side effects y bypasses fault injection. No usarlo para concluir que `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK` u otros comandos, ni fault injection, funcionan en el TMS real.
- Request base normativa: `CMD:DEBUG_ECHO|AUTH:<token>|MSG:HELLO\r\n`.
- Response real normativa: `ECHO|AUTH:OK|FIELDS_PARSED:3|MSG:HELLO\r\nEND\r\n`.
- Fields adicionales `X`, `Y`, `Z` con valores ASCII válidos son aceptados por el TMS, cuentan en `FIELDS_PARSED` y son descartados por el servidor. Un probe con los tres fields debe esperar `FIELDS_PARSED:6` (`CMD`, `AUTH`, `MSG`, `X`, `Y`, `Z`).
- Auth inválida debe clasificarse como remote `AUTH_FAILED`; el servidor cierra la conexión después del error. El adapter no reintenta, no devuelve token ni mensaje remoto y limpia el socket de forma segura.
- `responseToEchoResult` acepta **exactamente** dos shapes validados, sin fallback: el mock Phase 1 `{ MSG, FIELD_COUNT }` y el real `{ recordType: ECHO, AUTH: OK, FIELDS_PARSED, MSG }`. Debe exigir un único record, campos exactos por variante, message válido y conteo entero no negativo; devuelve siempre `{ message, fieldCount }` usando `FIELD_COUNT` o `FIELDS_PARSED` respectivamente.
- El marker, `AUTH`, `FIELDS_PARSED` y fields internos no se exponen por HTTP. La route `POST /api/tms/echo` conserva body, envelope y status del baseline; no se crean endpoints nuevos.

### Client, transport y lifecycle

El baseline de `src/tms/client.ts` ya abre una conexión/request, tiene connect/response timeouts, cleanup de listeners, no retry y espera `END` más `end`/`close` para detectar trailing. `src/tms/transport.ts` ya ofrece el seam de `node:net`. Mantener ese comportamiento y ajustar solo lo necesario para el contrato oficial:

- `transport.ts` solo conecta, escribe, recibe eventos y cierra; `client.ts` orquesta una operación y no contiene captura de evidencia, mapeos de echo ni reglas de booking.
- Ejecutar el guard antes de llamar al connector. Después de connect, escribir una sola request; no reuse de socket, pooling ni segunda request.
- Mantener timers separados de connect y response, ambos finitos y configurables. El server idle timeout documental es 30 s; el client no debe esperar ese máximo para detectar un stall. Usar el `TMS_RESPONSE_TIMEOUT_MS` existente, configurado de forma bounded para el runner, sin inventar otro protocolo de timeout.
- Después de un éxito, requerir `END` y el cierre/fin del peer para resolver; si hay bytes posteriores, rechazar con error de protocolo. Después de `ERR`, clasificar el error estructurado y limpiar sin esperar un retry; el cierre posterior del server no debe provocar doble settle.
- Ante connect error, write error, response error, EOF, close prematuro o timeout, limpiar timers/listeners de forma idempotente y destruir/cerrar como corresponda. Ignorar eventos tardíos y no dejar handles abiertos.
- El client no debe cambiar `retryable` a true para auth/protocolo/configuración ni ocultar una respuesta incompleta como éxito.

### Evidencia, fixtures y reporte

La captura/reporting es una frontera separada del runtime. Guardar, si es necesario, bajo `reports/tms/phase-2a/` y mantener fixtures reales separadas de datasets/mock.

Cada reporte sanitizado debe poder comparar, sin wire completo:

| Aspecto | Handbook | Real observado | Mock Phase 1 | Clasificación/decisión |
| --- | --- | --- | --- | --- |
| request order, field names y unknown fields |  |  |  |  |
| ASCII/probe, CRLF, byte count y límite 4096 |  |  |  |  |
| marker, response fields, `END` y `ERR` |  |  |  |  |
| chunks, EOF, server close y lifecycle |  |  |  |  |
| connect/response timeout y cleanup |  |  |  |  |
| auth failure y code remoto |  |  |  |  |

Registrar solo metadata mínima: identidad no sensible del entorno si es indispensable, fecha/momento, runner usado, resultado, nombres de fields, marker, counts, presencia de `END`, código remoto sanitizado, conteos de bytes y estado de cierre. No incluir host/port salvo una identidad redacted y necesaria; preferir omitirlos. Nunca guardar request/response raw completas, token, `MAX_BUY`, PII, `NOTES` innecesarias, payloads completos ni valores que permitan reconstruir credenciales.

Cada diferencia debe recibir exactamente una clasificación: `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`. Un `handbook ambiguity`/`unknown` crítico bloquea el cierre de 2A; no se resuelve relajando el parser, modificando el mock para ocultarlo o usando un fallback.

## Extraction Plan

- Extraer la resolución de `TMS_MODE`, `TMS_ENV`, `TMS_REAL_ENABLED`, target config y límites en `config.ts`/módulo server-only; centralizar defaults y no leer secretos desde módulos de browser.
- Extraer `assertRealActivation` y `assertCommandAllowed` en un policy module único. La allowlist real debe contener exclusivamente `DEBUG_ECHO` y ejecutarse antes del connector.
- Mantener request codec y validadores de identifiers/values en `protocol.ts`; no reutilizar una regla de reserved fields que bloquee `AUTH` en responses.
- Mantener estado incremental, framing, markers, response fields y terminales en `parser.ts`; no agregar IO, logs de evidencia ni mappers de negocio.
- Representar `recordType`/equivalente solo donde exista marker; mantener records field-only y tests de Phase 1 compatibles.
- Mantener IO/listeners/timers/teardown en `transport.ts`/`client.ts`; no añadir allí clasificación handbook/mock ni generación de reportes.
- Mantener las dos variantes de echo en `echo.ts`, con validadores explícitos y una salida pública estable; no aceptar shapes por presencia parcial de `MSG`.
- Centralizar constantes/nombres para 4096 bytes, CRLF, timeout bounded, commands permitidos, códigos de redacción y clasificaciones de diferencias.
- Aislar runner real, flags opcionales, fixtures y sanitizador de los tests/mock locales. Nunca hacer que el mock adopte la respuesta real como autoridad.

## Modularity Risks

- [ ] **God module:** no combinar env/guard, TCP, parser, mapper, evidencia y HTTP en `route.ts` o `client.ts`.
- [ ] **Policy duplicada:** una sola fuente decide modo y allowlist; rutas, client y runner no implementan variantes divergentes.
- [ ] **Regresión de Phase 1:** no reemplazar el shape local `MSG` + `FIELD_COUNT`, el mock, `MAX_BUY` internal-only ni los contratos de loads/booking para acomodar `ECHO`.
- [ ] **Parser permisivo:** no tratar `ECHO` como field genérico, no permitir `AUTH` de request por accidente y no convertir EOF/parciales en éxito.
- [ ] **Activación accidental:** `npm test`, CI, una route local o un env incompleto nunca deben abrir el target real.
- [ ] **Secret leakage:** no loggear token, host/port reales, wire, `MAX_BUY`, PII o `NOTES`; la redacción debe ocurrir antes de persistir o imprimir.
- [ ] **Scope creep:** no ejecutar ni preparar requests reales de loads/booking, fault injection, TLS, retries, pooling, persistencia, OAuth, túneles, HappyRobot, FMCSA, voice o deployment.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [x] No aplica Visual Fidelity: Phase 2A es integración backend/TCP, sin UI, Figma, maquetación ni revisión visual Playwright.

## Technical Approach

Mantener dos tracks independientes: mock/local determinista como default y real autorizado como operación explícita. El mock sirve para regresión y contraste, no para decidir el contrato real.

El baseline que debe quedar documentado antes de cambiarlo es:

- `src/tms/client.ts` ya hace una conexión y request, tiene connect/response timeouts, cleanup, no retry y usa `END` + `end`/`close` para detectar trailing.
- `src/tms/protocol.ts` ya genera `CMD`, `AUTH`, fields y CRLF y limita bytes, pero responde al contrato local existente y actualmente serializa con el encoding global actual.
- `src/tms/parser.ts` actualmente parsea records `KEY:VALUE`, rechaza response `AUTH` como reservado y no representa el marker bare `ECHO`.
- `src/tms/echo.ts` actualmente exige el shape local `MSG` + `FIELD_COUNT`.
- `src/tms/config.ts` actualmente carga target/timeouts sin el activation guard compuesto; no debe inferir real por configuración parcial.

El ajuste debe ser mínimo y backward-compatible: separar request/response rules, permitir `AUTH` en response, representar explícitamente el marker `ECHO`, y validar únicamente los dos shapes de echo. El runner real debe probar solo ASCII y documentar que no se define comportamiento real para caracteres no ASCII. No cambiar el mock para imitar una observación hasta clasificarla.

## Implementation Steps

1. **Capturar baseline local sin cambios.** Ejecutar `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`; registrar resultados locales y confirmar que no existe ningún runner real dentro de esa ejecución.
2. **Registrar el contraste inicial.** Añadir al plan de evidencia la divergencia conocida `local MSG/FIELD_COUNT` versus `real ECHO/AUTH/FIELDS_PARSED`, el parser sin marker y el `AUTH` response reservado, sin modificar todavía el mock ni ocultar la diferencia.
3. **Implementar config y guard.** Centralizar defaults mock, triple exacta de activación, validación server-only de host/port/token, port válido, timeouts y límite; fallar cerrado ante missing/invalid/contradictory flags y no tocar la red cuando el guard falla.
4. **Aplicar la policy de command.** Permitir solo `DEBUG_ECHO` en real y probar que `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK` y un command desconocido son rechazados antes de invocar el connector o escribir bytes. Conservar el alcance local de Phase 1 en mock.
5. **Ajustar protocol/types/parser con compatibilidad.** Mantener `CMD` primero, `AUTH` obligatorio, fields uppercase, values sin framing, ASCII probes, CRLF y límite 4096 incluyendo terminador; separar request reserved-field rules de response parsing; agregar marker `ECHO`, response `AUTH`, `FIELDS_PARSED`, `END`, `ERR`, fragmentación y EOF estricto.
6. **Verificar lifecycle sin mezclar responsabilidades.** Conservar en client/transport una conexión por request, una escritura, connect/response timeouts bounded, cierre tras éxito/error, detección de trailing, cleanup idempotente y cero retries. No introducir pooling, TLS o fault injection.
7. **Actualizar el mapper de echo.** Aceptar solo mock `{ MSG, FIELD_COUNT }` o real `ECHO + AUTH:OK + FIELDS_PARSED + MSG`; mapear ambos a `{ message, fieldCount }` y mantener estable el endpoint existente.
8. **Crear tests locales y runner aislado.** Extender tests unitarios/integración locales sin cambiar sus expectativas de Phase 1. Excluir `tests/tms/real/**` de `npm test`; agregar `test:real-tms:echo` con una configuración/runner explícito y sin valores reales en código.
9. **Actualizar documentación y ejecutar checks locales.** Documentar en README setup opt-in, guard, no-goals, sanitización y comandos para PowerShell/Git Bash; cualquier `.env.example` debe contener solo nombres, defaults mock o placeholders no sensibles. Ejecutar `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`; confirmar que el runner real sigue fuera de `npm test`.
10. **Configurar el runtime fuera del repo.** Antes del check real, el usuario debe inyectar en el proceso los tres flags exactos y host/port/token por canal autorizado, sin escribirlos en archivos versionados, terminal history compartida, fixtures o reportes. El runner debe validar configuración antes de conectar.
11. **Ejecutar el real solo con autorización y comando explícito.** Ejecutar `npm run test:real-tms:echo` únicamente después del guard, autorización de red y configuración server-only. Probar el request base `HELLO` y, opcionalmente, `X/Y/Z`; el probe de auth inválida solo se ejecuta si se habilita explícitamente, nunca por default.
12. **Persistir evidencia sanitizada y reconciliar.** Comparar handbook esperado, real observado y mock para request, response, framing, lifecycle, timeout, auth y cleanup. No guardar frames completos ni secretos.
13. **Clasificar y cerrar el gate.** Clasificar cada diferencia como `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`; detener 2A si queda un `unknown`/ambiguity crítico o si el target no reproduce el contrato autorizado.
14. **Repetir regresión final.** Ejecutar nuevamente `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`; confirmar mock default, ausencia de retries/endpoints nuevos y que el runner real sigue excluido de `npm test`.

## Edge Cases

- Flags ausentes en mock, flags con espacios/mayúsculas/valores truthy, triple incompleta y combinaciones contradictorias: nunca activar real; los intentos explícitos inválidos fallan cerrado.
- `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN` ausentes, vacíos, con port no entero/fuera de 1–65535 o con valores solo disponibles en módulos de browser: error seguro antes del connector.
- Command operativo solicitado mientras `mode=real`: denegación sin connect, write, retry ni fallback mock.
- Request exactamente en 4096 bytes incluyendo CRLF, un byte por encima, fields `X/Y/Z`, field desconocido, duplicate/reserved field, `|`, CR o LF en value.
- Chunks de un byte, marker `ECHO` partido, `AUTH:OK` partido, `FIELDS_PARSED` partido, `END` partido/separado, múltiples records, trailing bytes y cierre después de `END`.
- Success sin `END`, EOF antes de `END`, CRLF parcial, LF aislado, CR sin LF, respuesta vacía, response marker desconocido, duplicate fields y field count no entero/negativo.
- `ERR` con `AUTH_FAILED`, code desconocido, falta de `CODE`/`MSG` o mensaje remoto sensible; conservar code estructurado sin exponer message/token.
- Error de connect/write, server idle de 30 s, response timeout bounded, close/error duplicados, eventos tardíos y cleanup repetido; no dejar handles ni resolver dos veces.
- Probes reales exclusivamente ASCII. Preservar tests locales de UTF-8 y no afirmar soporte real para caracteres no ASCII.
- `DEBUG_ECHO` exitoso no habilita fault injection ni comandos operativos. No ejecutar ningún load/booking como “smoke test”.
- El runner real invocado sin env suficiente debe fallar claramente y sin intentar conectar; no debe aparecer como skip silencioso. El probe de auth inválida queda omitido si su flag explícito no está presente.

## Risks / Open Decisions

- **Marker de response distinto al baseline:** el mock entrega fields-only y el TMS real entrega marker bare `ECHO`. Decisión: marker explícito y validado; no fallback genérico.
- **ASCII versus UTF-8 actual:** el handbook fija ASCII, mientras el baseline usa el encoding actual compatible con tests UTF-8. Decisión: probes reales ASCII y no alterar UTF-8 global; cualquier necesidad no ASCII queda abierta y bloquea una afirmación adicional de compatibilidad.
- **Policy del probe de auth inválida:** está autorizado solo como `DEBUG_ECHO` y debe requerir una habilitación separada y explícita; default off, sin token real en código/logs/evidencia. Si la autorización operativa no cubre ese probe, no ejecutarlo.
- **Carga de env:** usar variables del proceso inyectadas fuera del repo, sin imprimirlas ni escribir secretos en `.env`/fixtures. Documentar comandos equivalentes para PowerShell y Git Bash sin inline secrets; no agregar un loader que persista o loggee valores.
- **Cierre del server:** el handbook indica cierre después de response/error; el client debe esperar `END` + cierre para éxito, clasificar `ERR` y limpiar una sola vez, sin depender de retries ni reusar conexión.
- **Idle timeout remoto de 30 s versus client timeout:** conservar `TMS_CONNECT_TIMEOUT_MS`/`TMS_RESPONSE_TIMEOUT_MS` bounded y configurable; el valor concreto de ejecución se decide fuera del spec según la ventana autorizada y no debe hacer esperar el idle remoto completo. Una divergencia observada se registra, no se compensa con polling/retry.

## Verification Plan

- [ ] **Guard/config unit tests:** default/mock sin activation real; flags faltantes, inválidos, con whitespace/case incorrecto y contradictorios; real exige los tres valores exactos; host/port/token real obligatorios; port inválido; errores seguros sin valores.
- [ ] **Policy unit tests:** en real, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK` y command desconocido fallan antes de invocar un connector mock y antes de cualquier write; `DEBUG_ECHO` es el único permitido; mock conserva el comportamiento local existente.
- [ ] **Protocol/parser tests:** `CMD` primero, `AUTH` obligatorio, uppercase names, prohibición de framing, CRLF, límite 4096 por bytes y fields desconocidos; marker oficial `ECHO`, response `AUTH`, `FIELDS_PARSED`, `END`, `ERR`, codes desconocidos, chunks fragmentados y EOF/trailing; probes ASCII; tests de shape local Phase 1 preservados.
- [ ] **Echo mapper tests:** shape local `MSG` + `FIELD_COUNT`, shape real `ECHO` + `AUTH:OK` + `FIELDS_PARSED` + `MSG`, counts base/extra, campos faltantes/extra/incorrectos y ausencia de fallback; salida exacta `{ message, fieldCount }`.
- [ ] **Client/transport tests:** una conexión y una escritura por request, connect/response timeout, no retry, error/close/end race, server close, incomplete response, trailing después de `END`, cleanup idempotente, listeners removidos y cero handles filtrados.
- [ ] **Route/direct tests:** `POST /api/tms/echo` mantiene validación/envelope/shape en mock; en modo real solo permite el mismo echo; no se crean routes nuevas ni se modifica el contrato público de loads/booking.
- [ ] **Real opt-in tests:** `tests/tms/real/echo.test.ts` exige env/guard, falla claramente sin config, usa solo probes ASCII y timeout bounded, valida response base `FIELDS_PARSED:3`, opcionalmente `X/Y/Z` con `FIELDS_PARSED:6`, no reintenta y produce salida sanitizada. El auth-invalid probe solo corre con habilitación explícita y espera `AUTH_FAILED` sin token/message.
- [ ] **Suite separation:** `npm test` no descubre ni ejecuta `tests/tms/real/**`; `npm run test:real-tms:echo` es el único comando documentado para red real y no se activa por route, CI o default.
- [ ] **Evidence review:** cada ejecución real tiene reporte bajo `reports/tms/phase-2a/` o ubicación acordada, comparación handbook ↔ real ↔ mock, clasificación única por diferencia y revisión de ausencia de raw wire, host/port/token, `MAX_BUY`, PII y `NOTES` innecesarias.
- [ ] **Local regression:** después de cualquier cambio de parser/echo/client/config, pasan `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`; Phase 1 local conserva sus tests, mock, endpoints y comportamiento.

La carga de variables para la ejecución documentada debe ser compatible con ambos shells sin incluir valores en el comando versionado: PowerShell puede usar variables de entorno de la sesión (`$env:<NAME>`), y Git Bash puede usar `export <NAME>=...`; los valores deben provenir del canal autorizado/secret store del usuario y nunca imprimirse. El script npm no recibe ni embebe credenciales.

## Rollback Plan

- [ ] Desactivar o retirar la activación real del proceso y volver al modo mock/local; no dejar flags parciales que produzcan fallback silencioso.
- [ ] Revertir solo cambios de Phase 2A en config/policy/parser/mapper/client/tests/scripts/docs/fixtures/reportes, preservando los contratos y tests de Phase 1.
- [ ] Si el TMS real contradice handbook o adapter, detener el runner, conservar únicamente evidencia sanitizada y mantener el último comportamiento local aprobado.
- [ ] No “corregir” una divergencia editando el mock ni relajar validaciones para hacer pasar el probe. Abrir decisión para cualquier `handbook ambiguity`/`unknown` crítico.
- [ ] No ejecutar rollback mediante booking, cargas reales, retries, túneles, TLS, pooling o cambios de deployment.

## Acceptance Criteria

- [ ] Phase 1 local conserva tests, mock, routes, contratos y comportamiento; el baseline se ejecuta antes y después con `npm test`, typecheck, lint y build.
- [ ] El default es mock/local y no requiere ni activa el track real; no existe activación accidental desde `npm test`, CI o una route.
- [ ] El guard es fail-closed: real solo con `TMS_MODE=real`, `TMS_ENV=non-production` y `TMS_REAL_ENABLED=true` exactos; host/port/token son server-only, port válido y errores seguros.
- [ ] En real, `DEBUG_ECHO` es el único command permitido y los comandos operativos son rechazados antes de abrir/escribir el socket; no hay fallback, retry ni booking.
- [ ] Request real cumple TCP directo, ASCII probes, `CMD` primero, `AUTH` obligatorio, fields uppercase, values sin framing, CRLF y máximo 4096 bytes incluyendo terminador.
- [ ] El parser reconoce `ECHO` como marker, permite response `AUTH`, valida `FIELDS_PARSED`, exige `END` para éxito, detecta fragmentación/EOF/trailing y estructura `ERR` con codes desconocidos.
- [ ] `DEBUG_ECHO` base produce el shape real esperado y `FIELDS_PARSED:3`; el probe `X/Y/Z`, si se ejecuta, produce el count correspondiente (`6`) y no deja fields adicionales en el mapper público.
- [ ] `responseToEchoResult` acepta únicamente los dos shapes validados —mock `MSG` + `FIELD_COUNT` y real `ECHO` + `AUTH:OK` + `FIELDS_PARSED` + `MSG`— y conserva `{ message, fieldCount }`.
- [ ] Lifecycle es seguro: una request por conexión, cierre del server manejado, timeouts bounded, cleanup idempotente, EOF/close/error sin doble settle y cero retries.
- [ ] Auth inválida se clasifica como `AUTH_FAILED`, el server close se maneja, y ningún error/log/reporte/fixture expone token o mensaje remoto sensible.
- [ ] El runner real es opt-in, está aislado de `npm test`, falla claramente si falta configuración, no contiene valores reales y no ejecuta `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK` ni fault injection.
- [ ] Evidencia/reportes/fixtures son sanitizados y comparan handbook, real y mock sin raw request/response completos, host/port/token, `MAX_BUY`, PII o `NOTES` innecesarias.
- [ ] Cada diferencia tiene una de las seis clasificaciones requeridas; un `unknown` o `handbook ambiguity` crítico impide cerrar Phase 2A.
- [ ] No se agregan endpoints, HappyRobot, FMCSA, voice, deployment, OAuth, persistencia, pooling, retries, TLS ni túneles públicos.
- [ ] No aplica Visual Fidelity.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` pasan al cierre de la implementación local.
