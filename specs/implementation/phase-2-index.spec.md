# Phase 2 — Validación contra TMS real — Phase Index Specification

## Context

Phase 1A–1D está completa y commiteada en `986b023 fix: post-review corrections closing Phase 1 (lifecycle, booking, contracts)`, precedida por `11b1fd1`, `0255d95` y `2efdefa`. El baseline es un adapter local: Route Handlers Node → `node:net` → mock LTMS, con `DEBUG_ECHO`, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, parser incremental, codec, errores seguros, `MAX_BUY` internal-only y tests locales.

El objetivo de Phase 2 es validar progresivamente el adapter contra el TMS real provisto por el challenge. No se incorpora todavía HappyRobot, FMCSA, voice ni deployment. La fuente de verdad para el comportamiento real será el handbook oficial junto con la evidencia observada del TMS; el mock local sirve para regresión y comparación, pero no es autoridad del protocolo real.

Este documento es el índice/routing de Phase 2. Ya está disponible el documento `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`; se registra la referencia sin copiar credenciales. Están confirmados el acceso por TCP directo al candidate no productivo, el probe base real `DEBUG_ECHO` exitoso de Phase 2A, su evidencia sanitizada en `reports/tms/phase-2a/real-debug-echo.json` y el commit de Phase 2A `57c1a7c`. La autorización explícita de 2B cubre únicamente `LOAD_QUERY` y `LOAD_GET` read-only. La validación real sigue requiriendo que el usuario configure host/port/token como valores server-only fuera del chat y ejecute el runner opt-in.

### Routing de fases

| Fase | Alcance | Gate de entrada | Estado |
| --- | --- | --- | --- |
| **2A** | Conexión autorizada + `DEBUG_ECHO` real, sin efectos de negocio | Handbook `HR-LTMS-PR-001`, TCP directo, autorización explícita solo para `DEBUG_ECHO`, candidate no productivo y activation guard aceptado; valores runtime server-only configurados por el usuario antes del check real | **IMPLEMENTED — REAL DEBUG_ECHO VERIFIED** |
| **2B** | `LOAD_QUERY`/`LOAD_GET` reales, read-only | Salida real de 2A, handbook `HR-LTMS-PR-001`, autorización explícita read-only, capability/runner 2B separado y valores runtime server-only antes del check real | **IMPLEMENTED — REAL READ-ONLY LOADS VERIFIED** |
| **2C** | `LOAD_BOOK` real controlado | Salida de 2B, autorización explícita y entorno seguro/sandbox confirmado | Bloqueada explícitamente |

### No-goals de este índice

- No ejecutar booking real todavía; 2C solo queda descrita a alto nivel.
- No ejecutar `LOAD_QUERY`, `LOAD_GET` ni `LOAD_BOOK` en 2A; `DEBUG_ECHO` es el único comando permitido en esta fase y no prueba operational commands.
- No crear túneles públicos, retries no especificados, persistencia, pooling ni TLS.
- No añadir HappyRobot, FMCSA, voice workflows, deployment ni nuevos endpoints públicos.
- No usar `npm test` como mecanismo de validación o activación del track real; los tests reales son siempre opt-in.
- No inventar host, port, auth, campos, comandos, framing, encoding, límites o códigos remotos.
- No convertir el mock en autoridad ni modificarlo para ocultar una divergencia no clasificada.

## Dependencies / Inputs

- [x] Baseline de Phase 1A–1D y sus contratos locales, con regresión preservada.
- [x] Handbook oficial del TMS recibido: `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`. Para 2A documenta TCP directo, ASCII, CRLF, límite de request de 4096 bytes incluyendo terminador, una request por conexión, cierre del server después de la respuesta, `DEBUG_ECHO` como único comando permitido, response de éxito `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END`, y `ERR` estructurado con `CODE` + `MSG` y catálogo conocido no exhaustivo. No copiar credenciales.
- [x] Datos runtime del target —host, port y token— permanecen fuera del chat y no están disponibles en esta spec; el usuario debe configurarlos por un canal autorizado y mantenerlos server-only antes de cualquier check real, sin inventar ni registrar valores.
- [x] Acceso al target confirmado: TCP directo al candidate no productivo; Phase 2A ejecutó `DEBUG_ECHO` y Phase 2B tiene autorización explícita únicamente para `LOAD_QUERY`/`LOAD_GET` read-only, sin booking.
- [x] Ruta efectiva de red hacia el TMS real confirmada como acceso TCP directo; no se incorporan túneles ni restricciones no documentadas.
- [x] Semántica documental de `DEBUG_ECHO`: es el único comando permitido en 2A, bypasses fault injection y no prueba operational commands. La autorización de 2B no habilita `LOAD_BOOK`.
- [x] Plan de evidencia: la evidencia de 2A está sanitizada en `reports/tms/phase-2a/`; la evidencia de 2B se guardará separadamente bajo `reports/tms/phase-2b/`, sin secretos ni PII.
- [x] Activation guard aceptado: exige simultáneamente `TMS_MODE=real`, `TMS_ENV=non-production` y `TMS_REAL_ENABLED=true`, con mock como default y runners separados. La policy pública/2A conserva allowlist exclusiva de `DEBUG_ECHO`; la capability 2B añade únicamente `LOAD_QUERY`/`LOAD_GET` dentro del runner explícito y nunca en routes o `npm test`.
- [x] FMCSA web key disponible, pero no se usará ni incorporará en Phase 2A; FMCSA permanece fuera de alcance.

### Readiness gate de Phase 2A

El readiness gate de implementación está completado: **Phase 2A = IMPLEMENTED — REAL DEBUG_ECHO VERIFIED**. El handbook `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT` (`HR-LTMS-PR-001`) fija el contrato de 2A: transporte TCP directo, ASCII, CRLF, request máxima de 4096 bytes incluyendo terminador, una request por conexión, cierre del server después de la respuesta, `DEBUG_ECHO` como único comando permitido, response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END`, y `ERR` estructurado `CODE` + `MSG` con errores conocidos no exhaustivos. La ejecución base pasó y su evidencia sanitizada está en `reports/tms/phase-2a/real-debug-echo.json`, con commit `57c1a7c`. `DEBUG_ECHO` bypasses fault injection y no sirve para probar operational commands. Antes de cualquier nuevo check real el usuario debe configurar host/port/token server-only fuera del chat. Si apareciera cualquier conducta fuera de este contrato, debe abrirse una decisión de scope antes de continuar; no se implementará implícitamente.

### Readiness gate de Phase 2B

El gate de entrada de implementación está satisfecho: **Phase 2B = IMPLEMENTED — REAL READ-ONLY LOADS VERIFIED**. Se cuenta con la salida real de 2A, el handbook `HR-LTMS-PR-001`, la autorización explícita para `LOAD_QUERY`/`LOAD_GET` read-only y el spec detallado `specs/implementation/phase-2b-real-read-only-loads.spec.md`. El runner 2B se ejecutó contra el TMS real (candidate non-production), confirmando `LOAD_QUERY` y `LOAD_GET` read-only exitosos con un record cada uno, `END` detectado correctamente y cierre TCP del peer; la evidencia sanitizada está en `reports/tms/phase-2b/real-read-only-loads.json`. No se ejecutó `LOAD_BOOK`, y cualquier rerun sigue requiriendo runtime server-only y runner explícito.

El output gate de 2B exige validar query y detail sin `LOAD_BOOK`, conservar `DEBUG_ECHO` y toda la regresión local, comparar handbook + evidencia real + mock y clasificar cada divergencia exactamente como `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`. Un `unknown` o `handbook ambiguity` crítico, leakage de datos o una precondición no cumplida de `LOAD_GET` bloquea el cierre; una query con cero records y `END` sí es éxito de query.

### Evidencia requerida

- Referencia exacta al documento `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`, y al comportamiento esperado, sin copiar credenciales.
- Identidad no sensible del entorno, versión/fecha disponible, momento de la prueba y runner separado usado.
- Request y response observados de `DEBUG_ECHO`, contrastados con ASCII/CRLF, el máximo de 4096 bytes incluyendo terminador, el response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END` o el `ERR` estructurado `CODE` + `MSG`, sanitizados de tokens, credenciales, PII y payloads innecesarios.
- Resultado esperado versus resultado real, estado de la conexión y límites/timeout observados.
- Reportes y fixtures sanitizadas guardados dentro del repo, preferentemente bajo `reports/tms/phase-2a/`; si el directorio no existe, registrar esa ruta como candidata de creación durante Phase 2A.
- Reconciliación mock ↔ real, clasificación de cada diferencia y decisión tomada; ningún `unknown` se disfraza de éxito.

### Evidencia adicional requerida para Phase 2B

- Referencia a `HR-LTMS-PR-001`, runner 2B, environment candidate non-production y timestamp, sin host/port/token ni otros secretos.
- Para `LOAD_QUERY`: operation/probe, request field names, request/response byte counts, `END`, lifecycle, record count (incluido zero), field names permitidos y si hubo múltiples records; no values de filtros.
- Para `LOAD_GET`: solo ejecutar con un `LOAD_ID` válido observado/aprobado; registrar singularidad, fields permitidos, status/free-text presence y lifecycle sin guardar el ID ni los values. Si falta el ID, registrar `precondition-not-met` y no simular éxito.
- Comparación handbook ↔ real ↔ mock de framing, fields, cardinalidad, padding/free text, status, `MAX_BUY` redaction, public DTO y remote codes; no guardar raw wire, PII, `NOTES` completas ni `MAX_BUY`.
- Cada diferencia con exactamente una clasificación de 2B: `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`; las dos últimas bloquean cuando son críticas.

## Files / Modules

Los siguientes son objetivos de implementación de 2B; no implican cambios de código en esta actualización del índice:

- `src/tms/config.ts` — configuración server-only y separación explícita entre target local/mock y target real opt-in; aplicar el guard compuesto aceptado y no guardar valores reales.
- `src/tms/transport.ts` — conexión, lifecycle, timeout y teardown del adapter/transport; no mezclar codec ni reglas de negocio.
- `src/tms/client.ts` — orquestación de una llamada a través del transport y parser existentes; no convertirlo en módulo god.
- `src/tms/protocol.ts` y `src/tms/parser.ts` — codec/framing incremental para el contrato documentado; cualquier ajuste debe estar respaldado por handbook o captura real.
- `src/tms/echo.ts` y `app/api/tms/echo/route.ts` — conservar el endpoint/contrato público existente; no crear endpoints nuevos.
- `src/tms/errors.ts`, `src/tms/http.ts` y `src/tms/logger.ts` — clasificación, envelope y redacción segura.
- `mock/` y `tests/tms/*` — baseline local y comparación; el mock no se convierte en fuente de verdad.
- `tests/tms/real/` (candidato futuro) — pruebas reales opt-in mediante runner separado, aisladas del track local y desactivadas por defecto.
- `tests/tms/real/fixtures/` o ubicación equivalente (candidato futuro) — capturas sanitizadas, nunca credenciales ni wire sensible sin redacción.
- `reports/tms/phase-2a/` — reporte de evidencia y reconciliación generado únicamente durante una ejecución real autorizada.
- `specs/implementation/phase-2a-real-debug-echo.spec.md` — spec detallado implementado para el track real opt-in.
- `tests/tms/real/loads.test.ts`, `tests/tms/real/load-probe.ts` y `tests/tms/real/load-evidence.ts` — runner, selección segura de probes y evidencia sanitizada de 2B.
- `reports/tms/phase-2b/` — reporte de `LOAD_QUERY`/`LOAD_GET` con metadata, counts, field names no sensibles, bytes, lifecycle, terminal y remote codes sanitizados.
- `specs/implementation/phase-2b-real-read-only-loads.spec.md` — spec detallado de 2B para handoff a `@coder-heavy`.

## Module Boundaries / Contracts

- **Entrada pública:** reutilizar el endpoint existente de `DEBUG_ECHO`; el handler solo valida/orquesta y no abre sockets ni contiene protocolo. No agregar rutas para acceder al TMS real.
- **Configuración real:** server-only, explícita y opt-in; el default debe seguir siendo local/mock. La activación exige `TMS_MODE=real`, `TMS_ENV=non-production` y `TMS_REAL_ENABLED=true`, con policy pública/2A echo-only y capability 2B separada que solo permita `LOAD_QUERY`/`LOAD_GET` además de `DEBUG_ECHO`. Host, port, auth y demás valores provienen de inputs autorizados y no se imprimen ni se hardcodean.
- **Adapter/transport:** concentra IO, lifecycle, timeout y cleanup sobre TCP directo; usa una request por conexión y asume el cierre del server después de la respuesta. Conserva la ausencia de retries/pooling salvo una decisión documentada posterior. No implementar conductas adicionales no respaldadas.
- **Codec/parser:** mantiene una frontera pura y testeable para ASCII y CRLF, con request máxima de 4096 bytes incluyendo terminador. En 2A solo acepta `DEBUG_ECHO`; reconoce el response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END` y `ERR` estructurado con `CODE` + `MSG`, sin tratar el catálogo conocido como exhaustivo. Las reglas de wire del mock de Phase 1 no se declaran automáticamente contrato del TMS real; solo se cambian por evidencia documentada/observada.
- **Captura y fixtures:** separados del runtime; solo almacenan datos sanitizados y metadatos mínimos para reproducir/anotar la observación.
- **Tests reales:** red externa únicamente en un track opt-in ejecutado por runner separado y explícitamente habilitado, nunca como efecto colateral de `npm test` ni de la suite local; `npm test` no es el runner de esta validación.
- **Reporte:** registra expected/observed, evidencia, clasificación y decisión sin secretos; no es un canal de configuración ni de ejecución.
- **Contratos acumulados:** `MAX_BUY` continúa internal-only; 2A solo valida `DEBUG_ECHO`, y 2B solo puede ejecutar `LOAD_QUERY`/`LOAD_GET` mediante su runner read-only. Ninguna fase real ejecuta `LOAD_BOOK` en este índice. La semántica documentada de éxito/error queda registrada arriba; cualquier divergencia observada se clasifica, no se oculta.

## Extraction Plan

- Separar configuración del target real de la configuración/mock local, con un guard de activación centralizado (`TMS_MODE=real` + `TMS_ENV=non-production` + `TMS_REAL_ENABLED=true`), policy pública/2A echo-only, capability 2B read-only solo para el runner explícito y mock seguro por defecto.
- Mantener transport/adapter, codec/parser, validación HTTP, mapeo de errores, logging y reglas de negocio en módulos distintos; no ampliar handlers, `client.ts` o `parser.ts` monolíticamente.
- Representar sin ampliar el contrato documentado de 2A: TCP directo, ASCII, CRLF, request máxima de 4096 bytes incluyendo terminador, una request por conexión, cierre del server después de la respuesta, `DEBUG_ECHO` únicamente, response + `END` y `ERR` con `CODE` + `MSG`.
- Extraer una frontera de capture/sanitization para que las pruebas y el reporte nunca manejen directamente secretos o payloads sin redacción.
- Aislar el runner separado y fixtures del track real de los tests locales; permitir seams para transport, target y respuestas observadas sin acoplarlos al mock.
- Centralizar nombres de modo, límites, timeouts, clasificación de diferencias y políticas de redacción cuando estén confirmados; no inventar valores para llenar huecos.
- Mantener intactas las rutas y módulos de `LOAD_QUERY`, `LOAD_GET` y `LOAD_BOOK` hasta que sus fases tengan handbook, gates y specs propios.

## Modularity Risks

- [ ] Engordar handlers, `client.ts` o `parser.ts` con configuración real, captura, reportes, mappings y reglas de negocio; exigir separación por las fronteras anteriores.
- [ ] Leer variables de entorno o activar red real desde múltiples módulos; centralizar el guard opt-in y mantener mock/local como default.
- [ ] Mezclar fixtures reales con datasets del mock o guardar wire/credenciales sin sanitizar; separar ubicación y revisión de redacción.
- [ ] Hacer que tests reales se ejecuten en CI o `npm test` por accidente; el track real debe ser explícito, documentado y omitido por defecto.
- [ ] Cambiar el mock para que coincida con una observación antes de clasificarla; preservar ambos comportamientos y registrar la causa.
- [ ] Adelantar endpoints, booking, HappyRobot o abstracciones de deployment; 2A solo valida conexión y `DEBUG_ECHO` real.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [x] No aplica Visual Fidelity: Phase 2 es integración backend/TCP, sin UI, Figma, maquetación ni Playwright visual.

## Technical Approach

Phase 2 se ejecutará como una comparación controlada, no como sustitución inmediata del mock. Para 2A, el contrato documental de `HR-LTMS-PR-001` es el baseline de protocolo; la evidencia real puede confirmar o abrir una divergencia, pero no se completa con suposiciones:

1. Mantener dos tracks: local determinista contra mock y real opt-in contra el target autorizado.
2. Registrar el handbook recibido y usar el readiness gate ya abierto para el spec detallado/implementation de 2A, sin copiar valores runtime ni basarse en suposiciones.
3. Ejecutar el baseline local y, únicamente cuando el usuario haya configurado los valores server-only, habilitar mediante el runner separado y el guard aceptado una prueba mínima y autorizada de `DEBUG_ECHO`; capturar únicamente evidencia sanitizada y observar conexión, framing, respuesta, errores y teardown.
4. Aplicar solo ajustes mínimos y respaldados por evidencia en configuración/adapter/protocolo; no “adivinar” compatibilidad ni introducir retries o fallbacks silenciosos.
5. Repetir el track local antes y después de cualquier cambio, ejecutar el track real solo con su runner separado y comando opt-in definidos en el spec 2A, y cerrar con un reporte.

### Checklist de reconciliación mock ↔ TMS real

- [x] Handbook identificado como `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT` / `HR-LTMS-PR-001`; candidate no productivo, autorización exclusiva de `DEBUG_ECHO` y condiciones de prueba identificados sin exponer secretos.
- [ ] Request: campos, orden, ASCII, CRLF, framing, terminación y máximo de 4096 bytes incluyendo terminador observados frente a lo documentado.
- [ ] Response: `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END`, `ERR` con `CODE` + `MSG`, chunks, EOF y mapping observados frente a lo documentado; el catálogo de errores no se presume exhaustivo.
- [ ] Lifecycle: TCP directo, connect, una request por conexión, respuesta, cierre del server, timeout y cleanup, sin medir comportamiento no autorizado.
- [ ] Seguridad: logs, fixtures, reportes y metadata no contienen credenciales, tokens, wire completo sensible ni PII.
- [x] Activación: guard compuesto por `TMS_MODE=real` + `TMS_ENV=non-production` + `TMS_REAL_ENABLED=true`, allowlist exclusiva `DEBUG_ECHO`, runner separado y mock como default.
- [ ] Cada divergencia tiene evidencia, impacto, decisión y exactamente una clasificación: `adapter bug`, `mock bug`, `documented TMS behavior`, `spec gap`, `handbook ambiguity` o `unknown`.
- [ ] Las diferencias `handbook ambiguity`/`unknown` bloquean una decisión de compatibilidad; no se resuelven con una suposición.

### Checklist de reconciliación de Phase 2B

- [x] Gate de entrada: `DEBUG_ECHO` real base pasó, existe evidencia sanitizada y está registrada la autorización explícita read-only para `LOAD_QUERY`/`LOAD_GET`.
- [x] Request: filtro obligatorio, fields canónicos incluidos `ORIG_ZIP`/`DEST_ZIP` cuando estén respaldados, pickup date excluido, `CMD`/`AUTH`/CRLF, ASCII, byte limit y sin values sensibles.
- [x] Query response: cero o más records + `END`, múltiples records, field order no estable, padding, unknown fields, equipment sin matches y ceiling server-side observados sin asumir valores.
- [x] Detail response: `LOAD_ID` observado/aprobado, exactamente un record + `END`, resolución independiente de `STATUS`, free text/status adicional y `UNKNOWN_LOAD` estructurado cuando corresponda.
- [x] Public boundary: DTO estable, `NOTES` normalizada solo en application boundary, fields desconocidos/status/schedule/cargo/pricing adicional no expuestos y `MAX_BUY` ausente.
- [ ] Lifecycle/seguridad: una conexión por request, cierre peer, timeouts bounded, cero retries, ningún booking y evidencia/logs sin raw wire, PII, token, host/port, IDs, `NOTES` completas o `MAX_BUY`.
- [ ] Cada diferencia tiene exactamente una clasificación requerida; un `unknown`/`handbook ambiguity` crítico bloquea el cierre de 2B.

## Implementation Steps

1. Confirmar que el baseline de Phase 1 sigue vigente y ejecutar la regresión completa antes de cualquier cambio.
2. Mantener host/port/token fuera del chat y exigir que el usuario los configure server-only antes del primer check real; no realizar conexión real desde valores inventados o registrados en esta spec.
3. El spec detallado/implementation de 2A está creado en `phase-2a-real-debug-echo.spec.md`; mantener su contrato confirmado, activation guard, runner separado, captura sanitizada, tests opt-in y reporte.
4. Mantener/validar el track local y ejecutar el flujo `DEBUG_ECHO` real únicamente en el entorno autorizado, con el guard aceptado, el runner separado, una operación segura y evidencia sanitizada.
5. Reconciliar mock y TMS real, clasificar diferencias y pasar el gate de salida de 2A; si queda `unknown` crítico, detenerse.
6. Abrir 2B con handbook, salida real de 2A y acceso read-only confirmados para `LOAD_QUERY`/`LOAD_GET`; el spec detallado ya está en `phase-2b-real-read-only-loads.spec.md` y el estado es **READY FOR IMPLEMENTATION**.
7. Abrir 2C solo después de 2B, con autorización explícita del usuario, entorno seguro/sandbox o cargas de prueba confirmadas y procedimiento de side effects/rollback; no ejecutar booking como parte de 2A.

## Edge Cases

- Handbook `HR-LTMS-PR-001` desactualizado, contradictorio o ambiguo: mantener el bloqueo y pedir aclaración; no inferir protocolo.
- Si antes de un check real el usuario no configuró host/port/token por canal autorizado, o si host/port resulta inaccesible, auth es rechazada, la ventana está cerrada o el target es equivocado: detener la prueba y no reintentar automáticamente.
- TMS real con framing, encoding, campos, códigos o terminales distintos al mock: capturar, clasificar y decidir; no ocultar la diferencia en el parser.
- Respuesta vacía, parcial, fragmentada, EOF prematuro, timeout o cierre inesperado: conservar la evidencia sanitizada y distinguir fallo de transporte, protocolo o TMS documentado.
- Captura con secreto, PII o `NOTES` completa: no persistirla en fixtures/reporte; redaccionar o descartar según la política aprobada.
- `DEBUG_ECHO` bypasses fault injection: una respuesta exitosa no demuestra cobertura de operational commands ni autoriza `LOAD_QUERY`, `LOAD_GET` o `LOAD_BOOK`.
- Activación real accidental desde una prueba local, CI o route: el guard debe fallar cerrado y mantener mock/local.
- Requisito real de TLS, pooling, persistencia, retry o side effect no documentado: bloquear y abrir decisión de scope; no implementarlo en Phase 2A.
- Cualquier intento de `LOAD_QUERY`, `LOAD_GET` o `LOAD_BOOK` durante 2A: rechazarlo y registrar que la fase operativa correspondiente continúa bloqueada.

## Verification Plan

- [ ] Antes de cambios, ejecutar las verificaciones locales acordadas: `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`; `npm test` debe excluir el track real.
- [ ] Después de cualquier cambio, repetir esas verificaciones y comparar contra el baseline de Phase 1; el runner real continúa separado.
- [ ] El track local usa el mock, no requiere red externa y conserva tests, contratos, cleanup y ausencia de handles abiertos de Phase 1.
- [ ] El track real se ejecuta después del readiness gate únicamente mediante `npm run test:real-tms:echo` y con los valores server-only configurados por el usuario; requiere `TMS_MODE=real`, `TMS_ENV=non-production`, `TMS_REAL_ENABLED=true` y allowlist exclusiva `DEBUG_ECHO`.
- [ ] La prueba real opt-in solo ejerce `DEBUG_ECHO`, verifica el contrato documentado y produce evidencia sanitizada, logs seguros, resultado esperado/observado y reporte de reconciliación; `DEBUG_ECHO` bypasses fault injection y no prueba operational commands.
- [ ] 2A no se cierra si la conexión/`DEBUG_ECHO` no es reproducible o si una diferencia crítica queda sin clasificación/decisión.
- [ ] 2B exige verificación read-only independiente para query/detail; 2C exige autorización explícita, entorno seguro y verificación de side effects antes de cualquier booking.
- [ ] La ejecución de 2B, si se autoriza, usa un runner/config separado de echo y `npm test`, exige env server-only, no inventa filters/IDs y no ejecuta `LOAD_BOOK`.

## Rollback Plan

- [ ] Desactivar el guard/configuración real y volver al mock/local como default; nunca dejar un fallback silencioso que oculte un target incorrecto.
- [ ] Revertir únicamente cambios de Phase 2 en configuración, adapter, fixtures, tests y reportes, preservando el baseline y las specs de Phase 1.
- [ ] Si la evidencia contradice el handbook o el adapter, detener el track real, conservar el reporte sanitizado y mantener el último gate aprobado.
- [ ] Cualquier rollback de 2C deberá aprobarse antes de autorizar booking real; no se define ni ejecuta desde este índice.

## Acceptance Criteria

- [x] Existe un índice de Phase 2 que enruta 2A, 2B y 2C sin modificar specs de Phase 1; el spec detallado de 2A está separado.
- [x] El índice registra el handbook recibido `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`, sin credenciales ni afirmar que está ausente.
- [x] 2A queda claramente **IMPLEMENTED — REAL DEBUG_ECHO VERIFIED**; el probe base pasó, existe evidencia sanitizada en `reports/tms/phase-2a/real-debug-echo.json` y el commit es `57c1a7c`. Cualquier rerun sigue requiriendo host/port/token fuera del chat como valores server-only y opt-in.
- [x] El contrato de 2A queda fijado únicamente por el handbook: TCP directo, ASCII, CRLF, request máxima de 4096 bytes incluyendo terminador, una request por conexión, cierre del server después de la respuesta, `DEBUG_ECHO` único, response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END` y `ERR` con `CODE` + `MSG`, con catálogo de errores conocido no exhaustivo.
- [x] La fuente de verdad queda establecida como handbook + comportamiento observado; el mock se limita a regresión/comparación.
 - [x] El índice y el spec de 2B separan config/policy, adapter/transport, parser/mappers/services, captura/fixtures sanitizados, tests reales opt-in y reporte, sin agrandar módulos monolíticos ni añadir endpoints.
- [ ] El flujo y checklist de reconciliación cubren request, response, lifecycle, seguridad, query/detail, `MAX_BUY`/`NOTES` redaction y las seis clasificaciones de divergencia requeridas.
 - [x] La verificación excluye `npm test`, mantiene los tests reales opt-in y usa `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` antes y después; los runners de echo y loads permanecen separados.
 - [x] 2B está **IMPLEMENTED — REAL READ-ONLY LOADS VERIFIED** tras la ejecución real de `LOAD_QUERY` y `LOAD_GET` con evidencia sanitizada en `reports/tms/phase-2b/real-read-only-loads.json`; no se ejecutó `LOAD_BOOK`. 2C permanece bloqueada.
- [x] Quedan explícitos los no-goals: `LOAD_QUERY`/`LOAD_GET`/`LOAD_BOOK` en 2A, booking real, fault-injection/operational commands vía `DEBUG_ECHO`, mock como autoridad, ejecución real desde `npm test`, túneles públicos, retries no especificados, persistencia, pooling, TLS, HappyRobot, FMCSA, voice, deployment y endpoints nuevos.
- [x] No aplica Visual Fidelity.
