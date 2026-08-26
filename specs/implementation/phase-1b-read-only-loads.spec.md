# Phase 1B — Read-only LOAD_QUERY and LOAD_GET Specification

## Context

Esta fase depende de un 1A aprobado y amplía el baseline únicamente con lectura de cargas. Añade `LOAD_QUERY` y `LOAD_GET` sin booking, negociación ni fault injection configurable. Debe conservar intacto `DEBUG_ECHO` y reutilizar el codec/parser/cliente/configuración/errores seguros de 1A.

No aplica Visual Fidelity: no hay UI, Figma, maquetación ni Playwright visual.

## Dependencies / Inputs

- [ ] Gate de 1A aprobado: app, config, builder, parser básico, transporte, cliente, mock y tests esenciales funcionando.
- [ ] Contrato público de búsqueda del handoff: `originState?`, `destinationState?`, `originCity?`, `destinationCity?`, `equipmentType?`, `maxResults?`.
- [ ] Reglas de formatting de padding ASCII, ciudades, estados y ZIP del handbook; si el handbook no determina una variante, aislarla como decisión explícita y no mezclarla con TCP.
- [ ] No red externa, no TMS real/FMCSA/HappyRobot y no booking en esta fase.

## Files / Modules

- [ ] `app/api/tms/loads/search/route.ts` — único handler nuevo de búsqueda read-only; `runtime = "nodejs"`.
- [ ] `app/api/tms/loads/detail/route.ts` — único handler nuevo de detalle read-only; `runtime = "nodejs"`.
- [ ] `src/tms/types.ts` — tipos wire/internal/public de loads; `maxBuy` solo interno.
- [ ] `src/tms/http.ts` o validadores dedicados — DTO público, validaciones, mappers de request/response y status mapping sin mezclar socket.
- [ ] `src/tms/service.ts` o módulos de aplicación enfocados — operaciones `searchLoads` y `getLoad`; introducirlo solo como servicio pequeño, no como módulo god.
- [ ] `src/tms/protocol.ts` — extender builder genérico sintáctico para `LOAD_QUERY`/`LOAD_GET` y sus fields exactos.
- [ ] `src/tms/parser.ts` — extender records múltiples, padding y formatting sin acoplarse a routes.
- [ ] `mock/ltms-server.ts` — dispatch read-only de `LOAD_QUERY`/`LOAD_GET`, sin mutar dataset.
- [ ] `mock/dataset.ts` — dataset read-only determinista con al menos dos cargas disponibles, estados/tarifas distintos, `NOTES` vacías/no vacías y un caso con `MAX_BUY` interno.
- [ ] `tests/tms/types|http|service|protocol|parser|routes|integration` — separar archivos según claridad; no concentrar todo en un test monolítico.
- [ ] `README.md` — actualizar incrementalmente con endpoints y ejemplos read-only; documentación final ampliada queda para 1D.

## Module Boundaries / Contracts

- [ ] `POST /api/tms/loads/search` recibe exactamente el DTO público con campos opcionales indicados. Debe existir al menos un filtro; no aceptar como contrato principal `{ "filter": { "field", "value" } }`.
- [ ] El mapping es exacto: `originState → ORIG_STATE`, `destinationState → DEST_STATE`, `originCity → ORIG_CITY`, `destinationCity → DEST_CITY`, `equipmentType → EQTYPE`, `maxResults → MAX_RESULTS`, en request `LOAD_QUERY`.
- [ ] `equipmentType` se normaliza a mayúsculas; `maxResults` es entero positivo y está acotado por un límite centralizado. Los campos presentes deben validarse sin mutar el DTO público inesperadamente.
- [ ] `POST /api/tms/loads/detail` recibe `{ "loadId": string }` y produce `LOAD_GET` con `LOAD_ID`.
- [ ] `LOAD_QUERY` exige un filtro adicional y `LOAD_GET` exige `LOAD_ID`; faltantes producen error de validación o `MISSING_FIELD` según el punto de detección.
- [ ] Los mappers de response pueden conservar `MAX_BUY` en un modelo interno para validar reglas, pero nunca lo incluyen en DTO HTTP, logs o metadata pública. `NOTES` puede devolverse solo según el contrato público decidido; nunca se vuelca completa en logs.
- [ ] El parser admite múltiples records, cualquier orden de fields, padding ASCII externo, formatting de ciudades/estados/ZIP conforme al handbook, response vacía (`END\r\n`) y errores básicos `UNKNOWN_LOAD`, `MISSING_FIELD`, `AUTH_FAILED`, `UNKNOWN_CMD`.
- [ ] Los envelopes y statuses mantienen la base: success `{ok:true,data}`, error `{ok:false,error:{type,code,message,retryable}}`; 400 validation, 401 auth, 404 unknown load, 502 protocol/upstream y demás mappings centrales sin stack.
- [ ] El dataset local es read-only en 1B: al menos dos cargas disponibles con estados/tarifas distintos, `NOTES` vacías/no vacías y al menos un `MAX_BUY` internal-only. No existe booking behavior.
- [ ] `DEBUG_ECHO` continúa sin mutación y sus tests no dependen de cargas.

## Extraction Plan

- [ ] Extraer validadores DTO y mappers wire en `http.ts`/módulos dedicados; los handlers solo parsean, delegan y formatean.
- [ ] Extraer reglas de filtro, normalización de `EQTYPE`, límite de `maxResults` y formatting como funciones puras con constantes nombradas.
- [ ] Separar `LoadDetailInternal` de `LoadPublic`; probar que `maxBuy` no cruza la frontera.
- [ ] Mantener selección del dataset y serialización de records en el mock, no en el cliente productivo.
- [ ] Mantener parser genérico respecto al orden de fields; no codificar el layout de una sola carga en el parser.

## Modularity Risks

- [ ] No meter validación pública, lookup de dataset y wire framing en los handlers.
- [ ] No duplicar el mapping de nombres en `search` route, servicio y tests; centralizarlo.
- [ ] No transformar `MAX_BUY` en campo público por conveniencia de serialización.
- [ ] No implementar booking, retries o fault scenarios configurables como “preparación” de 1C/1D.
- [ ] No hacer que el parser conozca reglas de negocio de `LOAD_QUERY`; debe devolver records estructurados.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] No aplica Visual Fidelity. No usar Figma, no crear UI y no realizar revisión visual.

## Technical Approach

1. Mantener el foundation de 1A como shared transport/protocol/parser base.
2. Añadir tipos internos/públicos y validadores de los dos DTOs.
3. Extender el builder y el parser para commands/records read-only.
4. Añadir servicio/mappers enfocados y dataset local inmutable.
5. Añadir dos handlers, mock dispatch y tests unit/integration.

## Implementation Steps

1. Confirmar el gate 1A y congelar sus contratos; ejecutar regresión de `DEBUG_ECHO` antes de cambiar módulos shared.
2. Añadir tipos `LoadQueryInput`, `LoadDetailInput`, records internos y modelos públicos separados de `maxBuy`.
3. Implementar validación del DTO search: al menos un filtro, shape exacto, strings válidos, `EQTYPE` en mayúsculas y `maxResults` positivo acotado. Implementar detail con `loadId` requerido.
4. Extender `protocol.ts` para mapping exacto a `LOAD_QUERY`/`LOAD_GET`, manteniendo `CMD`/`AUTH`/CRLF/límite y validación sintáctica sin allowlist rígida.
5. Extender `parser.ts` a múltiples records, field order independiente, padding ASCII y formatting de ciudades/estados/ZIP conforme al handbook; mantener END/ERR/EOF seguros.
6. Crear servicio read-only y mappers internos→públicos; filtrar `MAX_BUY` de HTTP/logs y centralizar error/status mapping.
7. Crear `mock/dataset.ts` y ampliar mock para devolver al menos dos cargas disponibles con variación de estados/tarifas, NOTES vacías/no vacías y MAX_BUY interno, sin mutación.
8. Crear únicamente los handlers `search` y `detail`, ambos Node runtime, y actualizar README con uso read-only.
9. Añadir tests unitarios de DTO/mapping/protocol/parser y tests integration de ambos comandos, shapes/status/envelopes, errores y no mutación.
10. Ejecutar typecheck, test, build/lint si configurados y regresión completa de 1A antes de solicitar el gate 1B.

## Edge Cases

- [ ] Search body vacío, JSON inválido, campos desconocidos si se rechazan, ningún filtro, filtros vacíos, `EQTYPE` mixed/lowercase y `maxResults` cero, negativo, decimal, no numérico o fuera de límite.
- [ ] Estados, ciudades y ZIP con padding externo, espacios internos, casing y formatos no válidos según handbook.
- [ ] Detail sin `loadId`, vacío, con caracteres de framing o carga inexistente.
- [ ] Response `END\r\n` sin records, múltiples records en orden variable, records con campos opcionales, padding de NOTES y respuesta con `AUTH_FAILED`, `UNKNOWN_CMD`, `MISSING_FIELD` o `UNKNOWN_LOAD`.
- [ ] Carga con `MAX_BUY` existe internamente, pero no aparece en response HTTP, logs ni metadata.
- [ ] Dos consultas consecutivas no alteran el dataset ni reutilizan socket; `DEBUG_ECHO` sigue funcionando.

## Verification Plan

- [ ] Tests de DTO verifican shape público, filtro mínimo, mapping exacto de los seis campos, uppercase de `EQTYPE` y límite positivo de `maxResults`.
- [ ] Tests de protocol verifican wire `LOAD_QUERY`/`LOAD_GET`, `LOAD_ID`, nombres exactos, CMD/AUTH/CRLF y límite heredado.
- [ ] Tests de parser verifican múltiples records, orden independiente, padding/ciudades/estados/ZIP según handbook, response vacía, ERR y EOF incompleto.
- [ ] Tests de service/mappers verifican resultados públicos, separación de `maxBuy`, `NOTES` y no mutación.
- [ ] Tests de routes/integration verifican ambos POST, status/envelopes, `AUTH_FAILED`, `UNKNOWN_CMD`, `MISSING_FIELD`, `UNKNOWN_LOAD`, sin stack/secrets/MAX_BUY y TCP local.
- [ ] Verificar que dos lecturas no cambian dataset y que cada operación abre socket nuevo.
- [ ] Ejecutar `typecheck`, `test`, `build` y `lint` si existe configuración; nunca red externa.

## Rollback Plan

- [ ] Revertir solo handlers, service/mappers, dataset, extensiones shared y tests de 1B; mantener 1A operativa.
- [ ] Si el formatting del handbook es ambiguo, aislar la decisión en formatter/tests y no cambiar el framing base ni el contrato echo.
- [ ] No resolver fallos de 1B añadiendo booking, retries o fault injection de 1D.

## Acceptance Criteria

- [ ] Se añaden solo `POST /api/tms/loads/search` y `POST /api/tms/loads/detail`, ambos read-only y Node runtime.
- [ ] Search usa exactamente el DTO del handoff, exige al menos un filtro, traduce exactamente `ORIG_STATE`, `DEST_STATE`, `ORIG_CITY`, `DEST_CITY`, `EQTYPE`, `MAX_RESULTS`, normaliza EQTYPE y acota maxResults.
- [ ] Detail traduce `loadId` exactamente a `LOAD_ID` en `LOAD_GET`.
- [ ] Parser y modelo soportan múltiples records, field order independiente, padding/formats del handbook, END vacío y errores read-only exigidos.
- [ ] Dataset tiene al menos dos disponibles, estados/tarifas distintos, NOTES vacías/no vacías y MAX_BUY interno; no hay booking ni mutación.
- [ ] `MAX_BUY` se filtra de DTO/log/HTTP y los envelopes/statuses son estables y seguros.
- [ ] Tests unit/integration cubren ambos comandos, shapes, mapping, errores, no mutación, no reuse y regresión de 1A.
