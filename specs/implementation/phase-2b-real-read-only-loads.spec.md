# Phase 2B — Real Read-Only Loads Specification

## Context

Este documento es el handoff execution-ready para `@coder-heavy`. En esta tarea solo se persiste esta especificación y se actualiza el índice de Phase 2; no se implementan código, tests, scripts, configuración, fixtures ni reportes.

Phase 1A–1D está cerrada y debe seguir siendo el baseline local completo: mock como default, `DEBUG_ECHO`, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, parser incremental, límites, errores seguros, cleanup, contratos HTTP y `MAX_BUY` internal-only. Phase 2A fue implementada y ejecutada contra el candidate TMS non-production: el probe base real `DEBUG_ECHO` pasó, la evidencia sanitizada está en `reports/tms/phase-2a/real-debug-echo.json` y el commit de Phase 2A es `57c1a7c`.

La fuente normativa es `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`, contrastada con evidencia real. El usuario autorizó explícitamente en el candidate non-production únicamente `LOAD_QUERY` y `LOAD_GET`, ambos read-only, además del `DEBUG_ECHO` ya validado. No se autoriza ni se ejecuta `LOAD_BOOK` en Phase 2B.

### Readiness y output gate

- **Estado de implementación:** `READY FOR IMPLEMENTATION`. La salida real de Phase 2A, la autorización read-only y el contrato documental de 2B están confirmados.
- **Estado de ejecución real:** sigue siendo opt-in y pendiente de que el usuario inyecte el runtime autorizado. Host, port y token reales solo pueden existir server-side/runtime, por el canal autorizado; nunca en chat, esta spec, código, logs, fixtures o commits.
- **Gate de cierre:** 2B solo puede cerrarse cuando se hayan ejercido, o se haya documentado de forma no ambigua por qué no es posible ejercer, los dos caminos read-only, se haya comparado handbook ↔ evidencia real ↔ mock, cada divergencia tenga exactamente una clasificación y no queden `unknown` o `handbook ambiguity` críticos. Una precondición faltante de `LOAD_GET` no es éxito: se reporta como `precondition-not-met` y deja el cierre pendiente.

El alcance es una validación controlada, no un cambio de proveedor ni una API pública nueva. Se conservan dos tracks: mock/local determinista por defecto y runner real separado, explícito y fail-closed.

## Dependencies / Inputs

- [x] Handbook `HR-LTMS-PR-001`: TCP directo, ASCII, CRLF, una request por conexión, cierre del server después de response/error, request máxima de 4096 bytes incluyendo el terminador y chunks arbitrarios.
- [x] Request oficial: `CMD:<command>|AUTH:<token>|<FIELD>:<VALUE>|...\r\n`; `CMD` primero, `AUTH` obligatorio, names uppercase, values sin `|`, CR o LF, y fields desconocidos aceptados/descartados por el TMS.
- [x] Response oficial: cero o más records seguidos de `END\r\n`; una query sin records es éxito si llega `END`; una respuesta sin `END` es incompleta.
- [x] `LOAD_QUERY`: requiere al menos un filtro además de `CMD`/`AUTH`; fields documentados `ORIG_STATE`, `DEST_STATE`, `ORIG_CITY`, `DEST_CITY`, `ORIG_ZIP`, `DEST_ZIP`, `EQTYPE` y `MAX_RESULTS`. Pickup date queda fuera hasta una decisión explícita respaldada por el contrato público.
- [x] Semántica documentada: state/ZIP strict, city forgiving, equipment no soportado puede producir cero records sin error, el ceiling de `MAX_RESULTS` es server-side y el order de fields no es estable.
- [x] `LOAD_GET`: requiere `LOAD_ID`, retorna un record más `END`, puede contener schedule/cargo/free text/pricing/status, puede resolver independientemente de `STATUS` y usa `UNKNOWN_LOAD` para un load desconocido.
- [x] `NOTES`, `COMMODITY` y `DIMS` son free text; `NOTES` puede venir blank o padded. `MAX_BUY` es internal-only: nunca se publica, loggea, persiste en evidencia ni se infiere su relación con `RATE`.
- [x] Error codes conocidos, no exhaustivos: `AUTH_FAILED`, `UNKNOWN_CMD`, `MISSING_FIELD`, `UNKNOWN_LOAD`, `ALREADY_BOOKED`, `INVALID_RATE`, `MALFORMED` y `SERVER_ERROR`. Los codes desconocidos se conservan estructurados y sanitizados.
- [x] Evidencia real de Phase 2A disponible y sanitizada; no se debe reescribir ni ampliar con datos de loads.
- [x] El adapter existente ya separa `config`, `policy`, `protocol`, `parser`, `transport`, `client`, `loads`, `service`, routes, mock y tests; reutilizar esas fronteras antes de crear abstracciones nuevas.
- [ ] Antes del runner real deben existir un plan de probes seguro y sus inputs aprobados. No se pueden inventar valores de filtros ni `LOAD_ID`; se aceptan solo valores provistos por runtime autorizado, data observada por `LOAD_QUERY` o fixture sanitizada aprobada.
- [ ] El proceso real debe recibir los valores server-only por un canal autorizado. La spec solo puede nombrar variables/capacidades, nunca sus valores; no se pasan secretos por chat ni argumentos versionados.

## Files / Modules

La siguiente lista describe cambios de implementación posteriores a esta tarea. No implica que estos archivos se modifiquen ahora.

### Módulos existentes a modificar o extender

- `src/tms/policy.ts` — única fuente de verdad para scopes/capabilities y allowlists. Mantener el scope público/2A echo-only y añadir un scope explícito de runner 2B que permita solo `DEBUG_ECHO`, `LOAD_QUERY` y `LOAD_GET`; nunca `LOAD_BOOK` ni commands desconocidos.
- `src/tms/client.ts` — aceptar una policy/capability interna opcional sin romper el seam actual `TmsClient(config, connect)`. Ejecutar la decisión antes de conectar y antes de escribir; mantener una conexión, una request, una escritura, timeouts bounded, cierre y cero retries.
- `src/tms/types.ts` — extender el input de query con los nombres públicos necesarios para `ORIG_ZIP`/`DEST_ZIP` sin añadir pickup date; mantener `TmsRecord`, `TmsParsedResponse`, `LoadInternal`, `LoadPublic` y `MAX_BUY` compatibles con Phase 1. El tipo read-only no debe contener `maxBuy`.
- `src/tms/loads.ts` — validar inputs públicos, mapear los fields canónicos y crear un mapper read-only separado del mapper que alimenta booking. Aplicar normalización de application boundary para state/city/ZIP/`NOTES`; no asumir widths no documentados ni calcular `MAX_BUY`.
- `src/tms/service.ts` — conservar `searchLoads` para cero o más records y `getLoad` para exactamente un record; usar el mapper read-only en esas operaciones sin tocar `bookLoad` ni su contrato.
- `src/tms/protocol.ts` — revisar el builder existente para los fields de query/detail; cambiarlo solo si handbook o evidencia lo exige, manteniendo `CMD`/`AUTH`, CRLF, byte limit y compatibilidad local.
- `src/tms/parser.ts` — revisar el parser incremental solo ante evidencia. Debe aceptar records múltiples, order arbitrario, padding documentado, fields desconocidos sintácticamente válidos y `END`; no debe inventar markers, widths, enums ni semántica de negocio.
- `src/tms/config.ts` — verificar que siga siendo server-only, mock-default y exacto para la activación real (`TMS_MODE=real`, `TMS_ENV=non-production`, `TMS_REAL_ENABLED=true`). Solo modificarlo si hace falta centralizar el contexto del runner; nunca para que una route pública obtenga la capability 2B.
- `src/tms/errors.ts`, `src/tms/http.ts` y `src/tms/logger.ts` — conservar errores públicos seguros, codes remotos sanitizados y logs de metadata bounded. Ninguno recibe wire, values de fields, token, `NOTES` o `MAX_BUY`.
- `tests/tms/loads.test.ts` — unit tests de input/mapping, ZIP documentado, exclusión de pickup date, filtro obligatorio, zero-result semantics y redacción del DTO público.
- `tests/tms/service.test.ts` — tests de query con múltiples records, query vacía, detail singular, `UNKNOWN_LOAD`, status tolerado, free text y respuesta inválida sin `MAX_BUY` asumido.
- `tests/tms/protocol.test.ts`, `tests/tms/parser.test.ts` — conservar toda la regresión y agregar casos solo para fields/frames respaldados por handbook o evidencia.
- `tests/tms/policy.test.ts`, `tests/tms/client.test.ts` — probar scopes, pre-connect denial, una conexión/escritura por operación, cleanup, timeout, EOF, trailing y ausencia de retry.
- `tests/tms/loads.integration.test.ts` — mantener integración TCP con mock, incluida la lectura sin side effects; no convertir el mock en autoridad real.
- `tests/tms/load-routes.test.ts` — cobertura directa de `search`/`detail`: mock por default, DTO estable y denegación de una route pública en real antes de abrir socket; no añadir endpoints.
- `vitest.config.ts` — conservar la exclusión de `tests/tms/real/**` de `npm test`; modificar solo si una nueva ruta de tests pudiera descubrir real por accidente.
- `vitest.real.config.ts` — estrechar el config existente al runner de `DEBUG_ECHO` o separarlo explícitamente para que el script 2A no descubra `loads.test.ts`.
- `package.json` — conservar `test:real-tms:echo` y añadir un único script explícito para loads, por ejemplo `test:real-tms:loads`, apuntando a una configuración/include exclusivo de Phase 2B. `npm test` no se modifica para incluir real.
- `README.md` — documentar setup opt-in, separación de runners, guard, timeouts, no retries, no booking y carga de env sin valores reales; nunca documentar secretos inline.

### Módulos nuevos de test/operación real

- `tests/tms/real/loads.test.ts` — entrypoint Vitest opt-in para `LOAD_QUERY`/`LOAD_GET`; debe ser delgado, secuencial, sin `LOAD_BOOK`, sin retries y con fallo explícito si falta una precondición.
- `tests/tms/real/load-probe.ts` — resolver el plan de probes aprobado, ejecutar el client/service read-only y derivar un `LOAD_ID` únicamente de una respuesta observada o fixture autorizada. No contiene valores reales hardcodeados ni persiste responses.
- `tests/tms/real/load-evidence.ts` — tipos de summary, sanitizer y writer de archivos únicos create-only bajo `reports/tms/phase-2b/`; acepta solo metadata resumida, no `TmsRecord.rawLine`, DTOs completos ni configuración.
- `vitest.real.loads.config.ts` — configuración separada, si se elige split de configs, con include exclusivo de `tests/tms/real/loads.test.ts` y los mismos aliases/timeout bounded sin ampliar `npm test`.
- `reports/tms/phase-2b/real-read-only-loads-<timestamp>-<uuid>.json` — artefacto generado por una ejecución autorizada; no se crea en esta tarea y solo puede contener evidencia sanitizada.

### Fuera de modificación en 2B

- `src/tms/echo.ts`, `app/api/tms/echo/route.ts` y `tests/tms/real/echo.test.ts` deben conservar el contrato/probe de Phase 2A.
- `src/tms/booking.ts`, `app/api/tms/loads/book/route.ts`, tests de booking y `mock/dataset.ts` no se usan para el runner real. No se ejecutan errores de booking.
- `mock/ltms-server.ts` no se modifica para hacer coincidir una observación real. Un cambio futuro solo puede justificarse y clasificarse como `mock bug` por contrato/documentación, nunca para disfrazar una divergencia.
- No se crean routes, endpoints, túneles, OAuth, TLS, pooling, persistencia, HappyRobot, FMCSA, voice ni deployment.

## Module Boundaries / Contracts

### 1. Policy, capability y configuración

- La policy central debe distinguir al menos `mock/local`, `public-or-phase-2a-real` y `phase-2b-real-read-only-runner`. El nombre de la capability es interno; no forma parte de body HTTP ni de un field wire.
- En mock se conserva toda la capacidad local de Phase 1, incluido `LOAD_BOOK` para los tests locales. En real, la policy por defecto usada por routes públicas continúa permitiendo únicamente `DEBUG_ECHO`.
- Solo el entrypoint/config del runner 2B puede solicitar la capability read-only. Esa capability extiende la allowlist real de Phase 2A con `LOAD_QUERY` y `LOAD_GET`, y nada más. `LOAD_BOOK`, commands desconocidos y cualquier operación no documentada se rechazan antes de `connectTcp`, antes de `write` y sin fallback a mock.
- La selección de `mode=real` o la presencia de un host no basta para obtener la capability 2B. El constructor actual debe conservar un default seguro; el runner inyecta explícitamente la policy creada por la factory central.
- La activación real exige exactamente `TMS_MODE=real`, `TMS_ENV=non-production` y `TMS_REAL_ENABLED=true`. `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN`, connect timeout, response timeout y límites se leen server-side; valores faltantes, parciales o inválidos fallan cerrado sin abrir socket.
- No se añade una segunda allowlist en route, service, test o script. El script solo selecciona el runner; la decisión de command vive en `policy.ts`.

**Contratos mínimos (el naming puede ajustarse, el boundary no):**

- `TmsExecutionScope` debe representar `mock-local`, `real-2a-echo` y `real-2b-read-only`; `TmsCommandPolicy.assertAllowed(command)` es el único punto de decisión.
- `ReadOnlyLoad` es privado y contiene únicamente los campos que forman el `LoadPublic` existente (`loadId`, origin/destination state/city, `equipmentType`, `rate`, `notes`); no contiene `maxBuy`, raw fields ni semántica adicional.
- `RealLoadProbePlan` es privado del runner: contiene un `LoadQueryInput` validado y un `LOAD_ID` opcional junto con su fuente (`observed-query` o `approved-runtime/fixture`); el valor del ID nunca se serializa.
- `SanitizedLoadProbeSummary` contiene solo `operation`, `outcome`, field names allowlisted, counts, byte counts, `END`, lifecycle, categorías de error y remote code sanitizado. No acepta `TmsConfig`, `TmsRecord.rawLine`, field values ni DTOs completos.

### 2. Transport, client y framing

- `transport.ts` conserva exclusivamente conexión TCP directa, eventos, escritura, cierre y destroy; `client.ts` orquesta una operación y mantiene el parser. Ninguno genera reportes ni conoce el mock.
- Cada `LOAD_QUERY` o `LOAD_GET` usa una conexión nueva, una request y una escritura. El server cierra tras response/error; el client espera `END` y el cierre/fin del peer para completar, limpia listeners/timers idempotentemente y no reintenta.
- La request se construye como `CMD` primero, `AUTH` segundo, fields uppercase, values sin framing y CRLF final. El tamaño se cuenta en bytes incluyendo CRLF y no supera 4096. Los probes reales deben usar valores ASCII; no se cambia el encoding global de Phase 1 por suposiciones.
- Connect/response timeouts son finitos, bounded y provienen de la configuración runtime autorizada. No se añade polling, retry, pooling ni espera deliberada del idle timeout remoto.

### 3. Protocol/parser

- `parser.ts` recibe `Buffer`/chunks arbitrarios, no asume que un chunk es una línea y exige CRLF estricto. `END\r\n` es obligatorio; `END` sin records es válido para `LOAD_QUERY`, no convierte una respuesta detail vacía en un load.
- Un record de load se trata como mapa `KEY:VALUE`; los fields válidos desconocidos se conservan solo en el record interno para que el mapper/evidence pueda observar sus nombres. No se descartan silenciosamente antes de la comparación.
- No se inventan markers bare, widths, enums de `STATUS` ni aliases de fields. Si aparece un marker o framing no documentado, se clasifica y se detiene la compatibilidad antes de relajar el parser.
- Fields duplicados, names inválidos, CR/LF aislados, bytes posteriores a `END`, EOF prematuro, frame overflow e invalid framing siguen siendo errores de protocolo. Cualquier ajuste debe ser backward-compatible con la regresión local.
- `ERR|CODE:<code>|MSG:<message>` se convierte en error remoto estructurado. El code se sanitiza/bounded; el `MSG` remoto no cruza logs, HTTP, evidencia ni errores públicos. Un code no catalogado no se convierte en `UNKNOWN_CMD` por defecto.
- `rawLine`/diagnósticos acotados, si se mantienen por compatibilidad, quedan privados del parser/client. No se pasan al reporter, no se imprimen y no se usan para “comparar” guardando wire.

### 4. Query/detail inputs y mappers

- El input público mantiene el estilo existente: `originState`, `destinationState`, `originCity`, `destinationCity`, `originZip`, `destinationZip`, `equipmentType` y `maxResults`. `maxResults` solo limita; no cuenta como filtro. La request requiere al menos uno de los siete fields de ubicación/equipment y nunca se envía una query sin filtro.
- `toLoadQueryFields` mapea exactamente `ORIG_STATE`, `DEST_STATE`, `ORIG_CITY`, `DEST_CITY`, `ORIG_ZIP`, `DEST_ZIP`, `EQTYPE`, `MAX_RESULTS`. Pickup date no se añade ni se acepta como unknown key salvo decisión posterior explícita.
- State y ZIP deben seguir la regla strict del handbook. Si el extract disponible no enumera una width/pattern exacta de ZIP, no se inventa una validación de cinco dígitos: se usa solo la validación segura de framing y se registra `handbook ambiguity`/`spec gap` para no afirmar soporte incompleto. City conserva su comportamiento forgiving y no se endurece por el mock.
- `MAX_RESULTS` no se usa para inferir el ceiling remoto. Una respuesta con menos records que el valor solicitado puede ser comportamiento server-side documentado; el order de records/fields no se compara posicionalmente.
- El mapper read-only debe devolver el `LoadPublic` existente, con `loadId`, states, cities, `equipmentType`, `rate` y `notes`, sin `status`, schedule, cargo, `COMMODITY`, `DIMS`, pricing adicional ni fields desconocidos. No se amplía el DTO público sin handbook + evidencia + decisión.
- `NOTES` se normaliza únicamente en el boundary de aplicación: blank/padded se convierte al resultado público establecido, sin copiar su texto a evidencia/logs. `COMMODITY`, `DIMS` y demás free text se tratan como opacos y no se exponen automáticamente.
- Se conserva `LoadInternal` y su `maxBuy` para el mock/booking de Phase 1. El mapper read-only no requiere `MAX_BUY`, no lo devuelve y no calcula `MAX_BUY` desde `RATE` ni desde ningún pricing field. Si el TMS lo incluye, se ignora en el DTO y se excluye de logs/evidence/errors.
- `searchLoads` mapea cero o más records, incluyendo múltiples records en una sola response; si un record no contiene los fields públicos requeridos, falla cerrado en vez de descartarlo o inventar un valor. `getLoad` acepta exactamente un record. `ERR UNKNOWN_LOAD` conserva su mapping existente; `END` sin record en detail es response inválida, no un `UNKNOWN_LOAD` fingido; más de un record también es inválido.
- Un load con cualquier `STATUS` documentado puede resolverse por `LOAD_GET`; el service no filtra por status ni convierte `BOOKED` en error durante 2B.

### 5. Routes y DTO público

- `POST /api/tms/loads/search` y `POST /api/tms/loads/detail` conservan body, envelope, status y sanitización del baseline. No reciben ni fabrican la capability 2B.
- La validación/mapper se prueba directamente sin hacer que una route pública active el target real. Si el proceso está en real, la route usa su policy default y rechaza `LOAD_QUERY`/`LOAD_GET` antes de abrir socket; el runner real usa el client/service directamente.
- No se exponen token, host/port, `MAX_BUY`, raw fields, remote `MSG` ni free text adicional en HTTP. `LoadPublic` permanece la única salida de loads.

### 6. Runner, precondiciones, evidencia y comparación

- El runner 2B carga configuración server-only, exige el modo real exacto y obtiene la capability desde `policy.ts`. Ejecuta secuencialmente probes válidos de `LOAD_QUERY` y, solo si existe un `LOAD_ID` válido observado/aprobado, `LOAD_GET`.
- El plan de query debe venir de inputs documentados/observados o fixture sanitizada. No se hardcodean ciudades, states, ZIPs, equipment values ni IDs inventados. Un equipment no soportado puede devolver cero records con `END`; eso es éxito del transporte/protocolo, no un test fallido.
- El runner puede envolver el `LoadTmsPort` con un capturador que resume la response antes de entregarla al service. El capturador nunca serializa `TmsRecord.fields` values, `rawLine` ni DTO completo.
- Si la query devuelve cero records, se registra `outcome: success`, `recordCount: 0`, `terminalEnd: true` y lifecycle observado. Eso no autoriza a inventar un ID. Si no hay ID válido para detail, se registra `outcome: precondition-not-met`, el runner termina no-success/blocked y no se presenta `LOAD_GET` como ejecutado.
- El reporte `reports/tms/phase-2b/real-read-only-loads.json` solo puede contener handbook ID, environment no sensible, runner, timestamp, operation/probe, outcome, names de fields permitidos, counts, record markers no sensibles, request/response byte counts, `END`, lifecycle, timeout/error category y remote code sanitizado. No contiene host/port real, token, raw wire, PII, valores de filtros/IDs, `NOTES` completas, `MAX_BUY` ni mensajes remotos.
- La reconciliación usa tres columnas: handbook esperado, real observado y mock/local. Cada diferencia recibe exactamente una de estas clasificaciones: `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`. Un `unknown`/`handbook ambiguity` crítico bloquea cierre; también se detiene si la diferencia afecta seguridad, framing, terminalidad, cardinalidad, read-only policy o redacción.

## Extraction Plan

- Mantener `config.ts` server-only y extraer la policy de scopes/capabilities en `policy.ts`; el default público nunca decide por sí solo habilitar cargas reales.
- Mantener transport/lifecycle en `transport.ts` + `client.ts`, request codec en `protocol.ts`, response framing en `parser.ts`, reglas de input/mappers en `loads.ts` y orquestación en `service.ts`.
- Extraer un tipo/método read-only de load en vez de debilitar `recordToLoadInternal` o mezclar `maxBuy` con el DTO público. `booking.ts` y su state quedan fuera del cambio.
- Extraer el plan de probes y la selección de `LOAD_ID` en `load-probe.ts`; no colocar lectura de env, sockets, mapping, assertions y escritura de reportes en `loads.test.ts`.
- Extraer el resumen/sanitización/writer en `load-evidence.ts`; su API recibe summaries ya acotados y no acepta secrets, raw wire, records completos ni DTOs completos.
- Centralizar constants de commands, canonical field names, request limit, terminal `END`, scopes, outcomes, classifications y sensitive-field redaction. No duplicar allowlists ni literales de policy en tests/routes.
- Mantener mocks y fixtures locales separados de evidencia real. Una fixture real solo puede contener inputs sanitizados aprobados; no puede ser un dump de response.

## Modularity Risks

- [ ] **God module:** no combinar en `route.ts`, `client.ts` o `loads.test.ts` policy, env, TCP, parser, mapping, assertions y reporting.
- [ ] **Allowlist duplicada:** `policy.ts` debe ser la única autoridad; route, service y runner no mantienen copias divergentes.
- [ ] **Capability accidental:** `TMS_MODE=real` no debe habilitar loads desde una route, `npm test`, CI o un import incidental.
- [ ] **Regresión de Phase 1:** no eliminar `LoadInternal.maxBuy`, booking local, mock, `DEBUG_ECHO`, contratos HTTP ni tests existentes para acomodar el TMS real.
- [ ] **Mock como autoridad:** una diferencia observada no se corrige cambiando el mock antes de clasificarla.
- [ ] **Parser permisivo:** no aceptar markers, widths, aliases, EOF o trailing bytes no confirmados solo para hacer pasar el runner.
- [ ] **Mapper monolítico:** separar query/detail cardinality, mapping público y datos internos; no meter status/free text/booking en el read-only mapper.
- [ ] **Fuga de datos:** no registrar values de fields, `NOTES`, `MAX_BUY`, PII, IDs, token, host/port ni wire completo; redactar antes de persistir.
- [ ] **Runner acoplado:** el config 2A no debe descubrir el test 2B; `npm test` debe seguir omitiendo todo `tests/tms/real/**`.
- [ ] **Scope creep:** no implementar `LOAD_BOOK`, OAuth, TLS, túneles públicos, pooling, retries, persistencia, HappyRobot, FMCSA, voice, deployment ni endpoints nuevos.

## Visual Fidelity (no aplica)

- [x] Phase 2B es integración backend/TCP y evidencia; no incluye Figma, UI, maquetación, componentes visuales ni Playwright visual.

## Technical Approach

La primera implementación debe ser incremental y backward-compatible:

1. Confirmar baseline local y la evidencia ya existente de Phase 2A sin reabrir su scope.
2. Convertir la policy actual echo-only en una capability centralizada: default/mock conserva Phase 1, real público conserva `DEBUG_ECHO`, y solo el runner explícito 2B recibe `DEBUG_ECHO` + `LOAD_QUERY` + `LOAD_GET`.
3. Añadir únicamente los fields públicos de query respaldados por el handbook (`ORIG_ZIP`/`DEST_ZIP`) y una validación que no invente widths. Mantener pickup date fuera.
4. Separar el mapper read-only del mapper que depende de `MAX_BUY`; mantener la salida `LoadPublic` y no publicar semántica adicional de `LOAD_GET`.
5. Reutilizar `TmsClient`, `protocol`, `parser`, `loads` y `service`. Cualquier cambio de protocolo/parser debe tener un caso de handbook o evidencia real y pasar toda la regresión.
6. Crear tests unitarios/locales y cobertura directa de routes antes del runner real. Probar múltiples records con responses locales sintéticas, sin modificar el mock para simular datos reales.
7. Aislar el runner real y el config de Vitest. Ejecutar únicamente probes read-only, secuenciales, bounded y sin retries; resolver detail solo desde un ID observado/aprobado.
8. Persistir summaries sanitizados y reconciliar handbook, real y mock. No tratar una response real como autorización para cambiar el mock o ampliar la API.
9. Ejecutar el baseline/final local exacto y, con autorización/runtime configurado, los runners reales separados. Phase 2B no se cierra si la evidencia o una divergencia crítica es ambigua.

## Implementation Steps

1. **Capturar baseline.** Ejecutar exactamente `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`; registrar solo resultados de tooling, confirmar que `npm test` no descubre `tests/tms/real/**` y no tocar Phase 1.
2. **Revisar gate de 2A.** Verificar el reporte sanitizado `reports/tms/phase-2a/real-debug-echo.json`, el probe base exitoso y el commit `57c1a7c`; no volver a usar `DEBUG_ECHO` como evidencia de operaciones de loads.
3. **Implementar policy central.** Mantener la activación exacta, crear la capability 2B solo para el entrypoint real explícito y probar que routes/default/client local no pueden obtenerla. El rechazo de `LOAD_BOOK` debe ocurrir antes de connector/write en tests locales; no se envía booking real.
4. **Preservar client/transport.** Mantener una request por conexión, `END` + peer close, timers bounded, cleanup idempotente y cero retries. Extender el seam solo lo necesario para inyectar la policy sin romper tests existentes.
5. **Extender inputs/codec.** Añadir `ORIG_ZIP`/`DEST_ZIP` siguiendo el contrato documentado, mantener filtro obligatorio, `MAX_RESULTS` como limitador y pickup date rechazado. No inventar widths ni modificar la semántica forgiving de city.
6. **Separar mappers.** Crear el camino read-only de `searchLoads`/`getLoad`, mapear múltiples/singular records y normalizar `NOTES` en application boundary. No exigir ni derivar `MAX_BUY` en este camino; conservar booking/local intacto.
7. **Ajustar parser solo con evidencia.** Verificar chunks, order arbitrario, padding, unknown fields, response empty/`END`, remote errors y fields adicionales. Si aparece una semántica no documentada, detener el cambio y clasificarla antes de relajar validación.
8. **Completar tests locales.** Añadir unit tests de policy/config/protocol/parser/loads/service, integración contra mock y route/direct tests. Cubrir query zero/multiple, detail singular/multiple/zero, status/free text, `MAX_BUY` redaction, field order y no exposure de values sensibles.
9. **Separar runners.** Hacer que el config/script 2A solo incluya echo y crear el config/script explícito de loads. Confirmar que ningún real test se ejecuta automáticamente por `npm test`, CI, route o import.
10. **Definir plan seguro de probes.** Resolver filters desde input runtime aprobado, data observada o fixture sanitizada. Validar antes de conectar; no hardcodear valores, no mandar query sin filtro y no fabricar `LOAD_ID`.
11. **Implementar evidencia.** Crear summaries bounded y writer bajo `reports/tms/phase-2b/`; persistir solo counts, field names no sensibles, bytes, terminal/lifecycle, outcome y remote codes. Omitir raw wire, token, host/port, PII, IDs, `NOTES` y `MAX_BUY`.
12. **Ejecutar query real opt-in.** Con env server-only y runner explícito, enviar solo un `LOAD_QUERY` documentado. Aceptar cero records + `END` como éxito; registrar counts y cardinalidad sin asumir order ni ceiling.
13. **Ejecutar detail real opt-in.** Usar únicamente un `LOAD_ID` válido observado en query o fixture/input aprobado. Si no existe, emitir `precondition-not-met`, escribir evidencia segura y terminar bloqueado/no-success; nunca fingir un detail exitoso ni inventar un ID.
14. **Reconciliar.** Comparar handbook + evidence real + mock/local para transporte, framing, fields, cardinalidad, padding/free text, status, public DTO, redaction, errors y lifecycle. Asignar exactamente una clasificación: `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`.
15. **Aplicar el output gate.** Corregir solo adapter bugs respaldados; documentar `documented TMS behavior`; no cambiar mock por reflejo. Detener si hay `unknown`/`handbook ambiguity` crítico, leakage, capability incorrecta, precondición de detail incumplida o contrato público sin respaldo.
16. **Repetir verificación final.** Ejecutar nuevamente los cuatro comandos locales exactos, revisar separación de suites y, solo si sigue autorizado, ejecutar el runner real separado. Confirmar que Phase 2C continúa bloqueada y no se envió ningún `LOAD_BOOK`.

## Edge Cases

- Flags reales ausentes, parciales, con whitespace, casing alternativo o valores truthy: no activan 2B y fallan cerrado en el runner; el default local sigue siendo mock.
- `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN` o timeouts faltantes/inválidos: no se abre socket, no hay fallback silencioso, no hay retry y no se imprime ningún valor.
- Una route pública o `npm test` intenta ejecutar `LOAD_QUERY`/`LOAD_GET` mientras el proceso tiene modo real: la policy pública lo rechaza antes de conectar; solo el runner 2B explícito puede usar la capability.
- Request sin filtro, con solo `MAX_RESULTS`, con pickup date o con fields desconocidos en el body público: rechazo local seguro; no se prueba una request inválida contra el TMS real.
- State/ZIP que no cumplen la regla documental: rechazo estricto. Si el handbook no fija width/pattern de ZIP, no adivinar; abrir `handbook ambiguity`/`spec gap`.
- City con casing/spacing permitido por el comportamiento forgiving: normalizar solo en application boundary y no usar el mock para afirmar una coincidencia real.
- Equipment no soportado: cero records con `END` es éxito; no mapearlo a remote error ni inventar un load.
- Query con cero, uno o múltiples records: `END` requerido; múltiples se mapean todos; comparison/report ordena names y compara cardinalidad, no posiciones.
- Query devuelve más/menos records que `MAX_RESULTS`: observar el ceiling server-side y clasificar; no asumir un valor ni modificar el mock para igualarlo.
- `LOAD_GET` con ID observado que resuelve aunque `STATUS` no sea `AVAILABLE`: éxito si el record cumple el contrato. `ERR UNKNOWN_LOAD` es error remoto conocido. `END` sin record o más de un record es response inválida.
- Query vacía no produce un ID: el query puede ser éxito, pero detail queda `precondition-not-met`; no usar IDs de ejemplo, dataset local ni valores inventados contra real.
- `NOTES` blank/padded, `COMMODITY`/`DIMS` u otro free text con PII: normalizar solo donde corresponda, no persistir values, no loggear y no incluir raw line en evidence.
- `MAX_BUY` presente, ausente o junto a pricing/status: no cruza el boundary público/evidence/error; nunca se deriva `RATE` desde `MAX_BUY` ni al revés.
- Field order distinto, fields desconocidos o widths no enumerados: parse defensivo por nombre, conservar solo metadata segura y no inventar aliases/widths. Una semántica adicional no documentada abre clasificación.
- Chunks de un byte, CRLF fragmentado, EOF antes de `END`, trailing bytes, timeout, error/close duplicados y eventos tardíos: conservar los contratos de parser/client, limpiar una vez y no reintentar.
- `ERR` con code conocido o desconocido: preservar solo code sanitizado/bounded. No provocar `ALREADY_BOOKED`/`INVALID_RATE` ni cualquier error de booking en 2B.
- Respuesta con marker bare no documentado para loads, `AUTH` inesperado o field público duplicado: no relajar parser automáticamente; detener y clasificar como corresponde.
- El reporter recibe accidentalmente un DTO completo, `rawLine` o configuración: debe rechazar ese input o reducirlo a un summary antes de persistir.

## Risks / Open Decisions

- **Strict ZIP sin width explícita:** usar únicamente la regla que figure en `HR-LTMS-PR-001`. Si el extract no fija el patrón, la implementación no puede inventar uno; la probe específica queda bloqueada por `handbook ambiguity`/`spec gap`.
- **Fields públicos reales:** el adapter existente expone `rate` y `notes`. Si `RATE` u otro field requerido por el DTO público no aparece en el real, no usar `PRICE`, `MAX_BUY` u otro campo como sustituto; registrar la divergencia y detener el cierre hasta decisión.
- **`MAX_BUY` del mock versus TMS real:** mantener el campo interno de Phase 1 para booking local, pero separar el mapper read-only y excluirlo completamente de evidencia. No asumir ninguna relación matemática con `RATE`.
- **Marker/width/semántica adicional:** el handbook no autoriza aliases, markers de load ni enums nuevos. Una observación no enumerada es evidencia para clasificar, no permiso para un parser permisivo.
- **Server ceiling de `MAX_RESULTS`:** el valor exacto observado no se fija en la spec; el runner registra count/metadata y no convierte una diferencia de ceiling en bug sin handbook/evidence suficiente.
- **Cobertura multi-record real:** no fabricar datos para forzarla. Si el plan autorizado solo produce cero/uno, reportar la cobertura no observada y no afirmar validación de cardinalidad multi-record; el gate decidirá si esa ausencia bloquea el cierre.
- **Precondición de detail:** un query vacío es resultado válido, pero sin ID no hay validación de `LOAD_GET`. El runner debe marcarlo no-success/blocked, no `skip` silencioso.
- **Separación 2A/2B:** la capability 2B debe ser explícita y central; ampliar globalmente `REAL_TMS_ALLOWED_COMMAND` o permitir que las routes heredenla sería un bloqueo de seguridad.
- **Public API:** solo ZIP está respaldado como field de query documentado; pickup date, status, schedule, cargo y pricing adicional quedan fuera salvo decisión posterior sustentada.
- **Resultado remoto no reproducible o handbook ambiguo:** conservar el reporte sanitizado, detener el runner y mantener el último comportamiento local aprobado; no compensar con retries, polling o cambios al mock.

## Verification Plan

### Baseline y regresión local

- [ ] Antes de cualquier cambio: `npm test`
- [ ] Antes de cualquier cambio: `npm run typecheck`
- [ ] Antes de cualquier cambio: `npm run lint`
- [ ] Antes de cualquier cambio: `npm run build`
- [ ] Después de cambios: repetir exactamente `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`.
- [ ] `npm test` sigue siendo local/mock, excluye `tests/tms/real/**` y no necesita red externa, secrets ni el candidate TMS.

### Cobertura de módulos y contratos

- [ ] Config/policy: mock default, triple real exacta, capability 2A/2B, public route denial, `LOAD_BOOK` rechazado antes de connector y ningún command no permitido.
- [ ] Protocol/parser: `CMD`/`AUTH`, canonical query/detail fields, CRLF, 4096 bytes, chunks, `END`, zero/multiple records, field order, unknown fields, padding y errors estructurados; toda la regresión de Phase 1 permanece.
- [ ] Loads/service: filter obligatorio, ZIP respaldado, pickup date ausente, city forgiving, unsupported equipment con zero result, query multi-record, detail singular, status tolerado, `UNKNOWN_LOAD`, free text y ausencia de `MAX_BUY` en `LoadPublic`.
- [ ] Client/transport: una conexión y write por operación, server close, timeout bounded, EOF/trailing/error races, cleanup idempotente, listeners removidos, cero retries y cero handles filtrados.
- [ ] Local integration: `LOAD_QUERY`/`LOAD_GET` contra mock sin side effects; no cambiar el mock para hacer pasar evidencia real.
- [ ] Route/direct: `POST /api/tms/loads/search` y `/detail` conservan envelope/status/DTO; en real público no conectan para loads; no existen endpoints nuevos.
- [ ] Evidence unit tests: solo summaries allowlisted, counts/bytes/field names/codes/lifecycle, `MAX_BUY`/`NOTES`/PII/IDs/token/host/port/raw wire ausentes.

### Runner real opt-in

- [ ] El runner de echo de Phase 2A conserva únicamente `DEBUG_ECHO`; `npm run test:real-tms:echo` no descubre Phase 2B.
- [ ] El runner de 2B tiene comando/config separado, por ejemplo `npm run test:real-tms:loads`, y no se ejecuta automáticamente desde `npm test`, CI, route o default.
- [ ] Antes de conectar, el runner exige configuración server-only, capability 2B y plan de probes aprobado; sin ello falla claramente, sin `skip` silencioso y sin retry.
- [ ] La ejecución real solo envía `LOAD_QUERY` y `LOAD_GET`, secuencialmente, con inputs no inventados, timeouts bounded y una conexión por request. No se envía `LOAD_BOOK` ni se prueban errores de booking.
- [ ] Query zero-result con `END` se registra como éxito. `LOAD_GET` solo corre con ID válido observado/aprobado; de lo contrario queda `precondition-not-met` y el proceso no reporta Phase 2B completa.
- [ ] Cada ejecución produce o intenta producir `reports/tms/phase-2b/real-read-only-loads.json` sanitizado con metadata, counts, field names no sensibles, bytes, terminal/lifecycle y remote codes; nunca raw wire, token, host/port, PII, `NOTES` completas, IDs o `MAX_BUY`.
- [ ] La reconciliación contiene handbook, observed real, mock/local, decisión e exactamente una clasificación por divergencia: `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`.
- [ ] No se cierra con `unknown`/`handbook ambiguity` crítico, leakage, capability pública accidental, precondición de detail incumplida o una afirmación de compatibilidad no respaldada.

## Rollback Plan

- [ ] Deshabilitar el script/config/runner 2B y retirar la capability read-only del proceso; la policy real vuelve a echo-only y el default local/mock permanece intacto.
- [ ] Revertir únicamente cambios de 2B en policy seam, mapper, parser/protocol respaldado, tests, scripts y configuración; preservar Phase 1, Phase 2A y `reports/tms/phase-2a/real-debug-echo.json`.
- [ ] Conservar el reporte 2B sanitizado para auditoría, pero detener cualquier runner si contradice handbook, filtra datos o produce una divergencia no clasificada. No borrar evidencia para ocultar un fallo.
- [ ] No se requiere rollback de side effects remotos porque 2B no autoriza `LOAD_BOOK`; no usar booking, retries, túneles, pooling, persistencia ni cambios de deployment para recuperar.
- [ ] Si el problema es exclusivamente del mock, mantener real/local separados y abrir una decisión `mock bug`; no cambiar el mock como workaround del adapter.

## Acceptance Criteria

- [ ] La implementación usa el handbook `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT` / `HR-LTMS-PR-001` y la evidencia real de Phase 2A como inputs, sin guardar secretos.
- [ ] Phase 1A–1D y Phase 2A `DEBUG_ECHO` quedan intactas; el probe/evidence `reports/tms/phase-2a/real-debug-echo.json` sigue siendo válido.
- [ ] El default es mock/local; ningún `npm test`, CI, route o import incidental ejecuta red real.
- [ ] La policy centralizada conserva echo-only para real público/2A y habilita `LOAD_QUERY`/`LOAD_GET` únicamente en una capability/runner 2B explícita. `LOAD_BOOK` y unknown commands se rechazan antes de connect/write.
- [ ] Runtime real requiere activación exacta, env server-only y timeouts/límites válidos; ningún valor real de host, port o token aparece en chat, spec, código, logs, fixtures, reportes o commits.
- [ ] `LOAD_QUERY` requiere un filtro documentado, usa solo fields canónicos, incluye ZIP solo con validación respaldada, excluye pickup date y mantiene `MAX_RESULTS` como ceiling observado del server, no como suposición local.
- [ ] `LOAD_QUERY` acepta response vacía con `END` como éxito y mapea múltiples records sin depender de field/record order.
- [ ] `LOAD_GET` envía solo `LOAD_ID`, usa un ID válido observado/aprobado, acepta un record + `END`, no filtra por status y conserva `UNKNOWN_LOAD` como error remoto cuando el TMS lo emite.
- [ ] Ausencia de ID válido produce `precondition-not-met` explícito y no se presenta como `LOAD_GET` exitoso.
- [ ] Parser/protocol son defensivos, byte-bounded, chunk-safe y backward-compatible; fields desconocidos/semántica adicional/widths no enumerados no se inventan ni se convierten en aliases silenciosos.
- [ ] El mapper read-only conserva el `LoadPublic` existente, normaliza `NOTES` en application boundary y no expone status, schedule, cargo, pricing adicional, free text desconocido, raw fields ni `MAX_BUY`.
- [ ] `MAX_BUY` continúa internal-only en todos los paths; no se exige, calcula, loggea, publica ni persiste en evidencia para validar loads reales.
- [ ] Tests unitarios, local integration y route/direct cubren policy, protocol/parser, mapping, cardinalidad, lifecycle, redaction y regresión de Phase 1.
- [ ] Existe un runner real opt-in separado para loads; el runner de echo no se amplía accidentalmente y ningún real test corre automáticamente.
- [ ] El runner real usa únicamente `LOAD_QUERY`/`LOAD_GET`, sin booking, sin errores de booking, sin retries, pooling, TLS, túneles, persistencia ni endpoints nuevos.
- [ ] El reporte bajo `reports/tms/phase-2b/` contiene solo metadata sanitizada: counts, field names permitidos, bytes, `END`, lifecycle, outcomes y remote codes; nunca raw wire, PII, values de filtros/IDs, token, host/port, `NOTES` completas o `MAX_BUY`.
- [ ] Handbook, evidencia real y mock/local se comparan con una clasificación única y exacta entre `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` y `unknown`.
- [ ] Cualquier `unknown`/`handbook ambiguity` crítico, leakage o precondición crítica no satisfecha bloquea el cierre; no se oculta modificando el mock ni relajando el parser.
- [ ] Baseline y cierre pasan exactamente `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`; los runners reales se verifican aparte y solo con autorización/runtime server-only.
- [ ] No se crea la spec de Phase 2C, no se modifican specs de Phase 1 y Phase 2C permanece bloqueada.
- [ ] Visual Fidelity no aplica.
