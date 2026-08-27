# Phase 2 — Validación contra TMS real — Phase Index Specification

## Context

Phase 1A–1D está completa y commiteada en `986b023 fix: post-review corrections closing Phase 1 (lifecycle, booking, contracts)`, precedida por `11b1fd1`, `0255d95` y `2efdefa`. El baseline es un adapter local: Route Handlers Node → `node:net` → mock LTMS, con `DEBUG_ECHO`, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, parser incremental, codec, errores seguros, `MAX_BUY` internal-only y tests locales.

El objetivo de Phase 2 es validar progresivamente el adapter contra el TMS real provisto por el challenge. No se incorpora todavía HappyRobot, FMCSA, voice ni deployment. La fuente de verdad para el comportamiento real será el handbook oficial junto con la evidencia observada del TMS; el mock local sirve para regresión y comparación, pero no es autoridad del protocolo real.

Este documento es el índice/routing de Phase 2. Ya está disponible el documento `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`; se registra la referencia sin copiar credenciales. Están confirmados el acceso por TCP directo al candidate no productivo, la autorización explícita únicamente para `DEBUG_ECHO` y la aceptación del activation guard. El spec detallado de Phase 2A está implementado localmente; la validación contra el TMS real sigue requiriendo que el usuario configure host/port/token como valores server-only fuera del chat y ejecute el runner opt-in.

### Routing de fases

| Fase | Alcance | Gate de entrada | Estado |
| --- | --- | --- | --- |
| **2A** | Conexión autorizada + `DEBUG_ECHO` real, sin efectos de negocio | Handbook `HR-LTMS-PR-001`, TCP directo, autorización explícita solo para `DEBUG_ECHO`, candidate no productivo y activation guard aceptado; valores runtime server-only configurados por el usuario antes del check real | **IMPLEMENTED — REAL-TMS RUN PENDING** |
| **2B** | `LOAD_QUERY`/`LOAD_GET` reales, read-only | Salida de 2A y semántica read-only documentada | Bloqueada por 2A |
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
- [x] Acceso al target confirmado: TCP directo al candidate no productivo, con autorización explícita únicamente para `DEBUG_ECHO` y alcance sin efectos de negocio.
- [x] Ruta efectiva de red hacia el TMS real confirmada como acceso TCP directo; no se incorporan túneles ni restricciones no documentadas.
- [x] Semántica documental de `DEBUG_ECHO`: es el único comando permitido en 2A, bypasses fault injection y no prueba operational commands. La autorización y el alcance no habilitan `LOAD_QUERY`, `LOAD_GET` ni `LOAD_BOOK`.
- [x] Plan de evidencia: los reportes y fixtures sanitizadas de la ejecución se guardarán dentro del repo, preferentemente bajo `reports/tms/phase-2a/`, sin secretos ni PII; si el directorio no existe, se acordará/creará durante Phase 2A.
- [x] Activation guard aceptado: exige simultáneamente `TMS_MODE=real`, `TMS_ENV=non-production` y `TMS_REAL_ENABLED=true`, con allowlist exclusiva de `DEBUG_ECHO`, runner separado del track local y mock como default. El track real permanece desactivado por defecto.
- [x] FMCSA web key disponible, pero no se usará ni incorporará en Phase 2A; FMCSA permanece fuera de alcance.

### Readiness gate de Phase 2A

El readiness gate de implementación está completado: **Phase 2A = IMPLEMENTED — REAL-TMS RUN PENDING**. El handbook `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT` (`HR-LTMS-PR-001`) fija el contrato de 2A: transporte TCP directo, ASCII, CRLF, request máxima de 4096 bytes incluyendo terminador, una request por conexión, cierre del server después de la respuesta, `DEBUG_ECHO` como único comando permitido, response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END`, y `ERR` estructurado `CODE` + `MSG` con errores conocidos no exhaustivos. También quedan confirmados el candidate no productivo, la autorización explícita solo para `DEBUG_ECHO` y el activation guard compuesto por `TMS_MODE=real` + `TMS_ENV=non-production` + `TMS_REAL_ENABLED=true`, allowlist exclusiva `DEBUG_ECHO`, runner separado y mock como default. Antes del check opt-in el usuario debe configurar host/port/token server-only fuera del chat. `DEBUG_ECHO` bypasses fault injection y no sirve para probar operational commands. Si apareciera cualquier conducta fuera de este contrato, debe abrirse una decisión de scope antes de continuar; no se implementará implícitamente.

### Evidencia requerida

- Referencia exacta al documento `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`, y al comportamiento esperado, sin copiar credenciales.
- Identidad no sensible del entorno, versión/fecha disponible, momento de la prueba y runner separado usado.
- Request y response observados de `DEBUG_ECHO`, contrastados con ASCII/CRLF, el máximo de 4096 bytes incluyendo terminador, el response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END` o el `ERR` estructurado `CODE` + `MSG`, sanitizados de tokens, credenciales, PII y payloads innecesarios.
- Resultado esperado versus resultado real, estado de la conexión y límites/timeout observados.
- Reportes y fixtures sanitizadas guardados dentro del repo, preferentemente bajo `reports/tms/phase-2a/`; si el directorio no existe, registrar esa ruta como candidata de creación durante Phase 2A.
- Reconciliación mock ↔ real, clasificación de cada diferencia y decisión tomada; ningún `unknown` se disfraza de éxito.

## Files / Modules

Los siguientes son candidatos a revisar o extender en un spec posterior; no implican cambios ahora:

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

## Module Boundaries / Contracts

- **Entrada pública:** reutilizar el endpoint existente de `DEBUG_ECHO`; el handler solo valida/orquesta y no abre sockets ni contiene protocolo. No agregar rutas para acceder al TMS real.
- **Configuración real:** server-only, explícita y opt-in; el default debe seguir siendo local/mock. La activación exige `TMS_MODE=real`, `TMS_ENV=non-production` y `TMS_REAL_ENABLED=true`, junto con allowlist exclusiva de `DEBUG_ECHO` y runner separado. Host, port, auth y demás valores provienen de inputs autorizados y no se imprimen ni se hardcodean.
- **Adapter/transport:** concentra IO, lifecycle, timeout y cleanup sobre TCP directo; usa una request por conexión y asume el cierre del server después de la respuesta. Conserva la ausencia de retries/pooling salvo una decisión documentada posterior. No implementar conductas adicionales no respaldadas.
- **Codec/parser:** mantiene una frontera pura y testeable para ASCII y CRLF, con request máxima de 4096 bytes incluyendo terminador. En 2A solo acepta `DEBUG_ECHO`; reconoce el response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END` y `ERR` estructurado con `CODE` + `MSG`, sin tratar el catálogo conocido como exhaustivo. Las reglas de wire del mock de Phase 1 no se declaran automáticamente contrato del TMS real; solo se cambian por evidencia documentada/observada.
- **Captura y fixtures:** separados del runtime; solo almacenan datos sanitizados y metadatos mínimos para reproducir/anotar la observación.
- **Tests reales:** red externa únicamente en un track opt-in ejecutado por runner separado y explícitamente habilitado, nunca como efecto colateral de `npm test` ni de la suite local; `npm test` no es el runner de esta validación.
- **Reporte:** registra expected/observed, evidencia, clasificación y decisión sin secretos; no es un canal de configuración ni de ejecución.
- **Contratos acumulados:** `MAX_BUY` continúa internal-only; 2A solo valida `DEBUG_ECHO` y no ejecuta `LOAD_QUERY`, `LOAD_GET` ni `LOAD_BOOK`. La semántica documentada de éxito/error queda registrada arriba; cualquier divergencia observada queda UNKNOWN hasta reconciliarla.

## Extraction Plan

- Separar configuración del target real de la configuración/mock local, con un guard de activación centralizado (`TMS_MODE=real` + `TMS_ENV=non-production` + `TMS_REAL_ENABLED=true`), allowlist exclusiva `DEBUG_ECHO` y mock seguro por defecto.
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

## Implementation Steps

1. Confirmar que el baseline de Phase 1 sigue vigente y ejecutar la regresión completa antes de cualquier cambio.
2. Mantener host/port/token fuera del chat y exigir que el usuario los configure server-only antes del primer check real; no realizar conexión real desde valores inventados o registrados en esta spec.
3. El spec detallado/implementation de 2A está creado en `phase-2a-real-debug-echo.spec.md`; mantener su contrato confirmado, activation guard, runner separado, captura sanitizada, tests opt-in y reporte.
4. Mantener/validar el track local y ejecutar el flujo `DEBUG_ECHO` real únicamente en el entorno autorizado, con el guard aceptado, el runner separado, una operación segura y evidencia sanitizada.
5. Reconciliar mock y TMS real, clasificar diferencias y pasar el gate de salida de 2A; si queda `unknown` crítico, detenerse.
6. Abrir 2B solo con handbook y acceso read-only confirmados para `LOAD_QUERY`/`LOAD_GET`; documentar su spec y gate por separado.
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

## Rollback Plan

- [ ] Desactivar el guard/configuración real y volver al mock/local como default; nunca dejar un fallback silencioso que oculte un target incorrecto.
- [ ] Revertir únicamente cambios de Phase 2 en configuración, adapter, fixtures, tests y reportes, preservando el baseline y las specs de Phase 1.
- [ ] Si la evidencia contradice el handbook o el adapter, detener el track real, conservar el reporte sanitizado y mantener el último gate aprobado.
- [ ] Cualquier rollback de 2C deberá aprobarse antes de autorizar booking real; no se define ni ejecuta desde este índice.

## Acceptance Criteria

- [x] Existe un índice de Phase 2 que enruta 2A, 2B y 2C sin modificar specs de Phase 1; el spec detallado de 2A está separado.
- [x] El índice registra el handbook recibido `TMS HANDBOOK CONTEXT — OFFICIAL EXTRACT`, Document ID `HR-LTMS-PR-001`, sin credenciales ni afirmar que está ausente.
- [x] 2A queda claramente **IMPLEMENTED — REAL-TMS RUN PENDING**. La ejecución real requiere que el usuario configure host/port/token fuera del chat como valores server-only y se mantiene opt-in.
- [x] El contrato de 2A queda fijado únicamente por el handbook: TCP directo, ASCII, CRLF, request máxima de 4096 bytes incluyendo terminador, una request por conexión, cierre del server después de la respuesta, `DEBUG_ECHO` único, response `ECHO|AUTH:OK|FIELDS_PARSED:<n>|MSG:<value>` + `END` y `ERR` con `CODE` + `MSG`, con catálogo de errores conocido no exhaustivo.
- [x] La fuente de verdad queda establecida como handbook + comportamiento observado; el mock se limita a regresión/comparación.
- [ ] El índice separa config real, adapter/transport, captura/fixtures sanitizados, tests reales opt-in y reporte, sin agrandar módulos monolíticos ni añadir endpoints.
- [ ] El flujo y checklist de reconciliación cubren request, response, lifecycle, seguridad y las seis clasificaciones de divergencia requeridas.
- [ ] La verificación excluye `npm test`, mantiene los tests reales opt-in y usa únicamente los checks estáticos/build acordados antes y después de cambios; los comandos reales quedan pendientes del spec detallado.
- [x] 2B permanece bloqueada hasta la salida de 2A y el acceso read-only documentado; 2C permanece bloqueada hasta autorización explícita y confirmación de entorno seguro.
- [x] Quedan explícitos los no-goals: `LOAD_QUERY`/`LOAD_GET`/`LOAD_BOOK` en 2A, booking real, fault-injection/operational commands vía `DEBUG_ECHO`, mock como autoridad, ejecución real desde `npm test`, túneles públicos, retries no especificados, persistencia, pooling, TLS, HappyRobot, FMCSA, voice, deployment y endpoints nuevos.
- [x] No aplica Visual Fidelity.
