# Happy Robot Challenge — Phase 1A–1D Implementation Index Specification

## Context

El handoff original de LTMS TCP era demasiado amplio para un único checkpoint, por lo que se dividió en cuatro fases incrementales, cada una ejecutable y verificable por separado. Las fases **1A, 1B, 1C y 1D están implementadas y verificadas**; este índice conserva el routing normativo y registra Phase 1D como el cierre actual de la fase.

No aplica Visual Fidelity: no hay UI, maquetación, Figma ni revisión de drift en ninguna fase de este índice.

## Dependencies / Inputs

- [ ] Ejecutar las fases en orden: 1A → 1B → 1C → 1D.
- [ ] Usar [`phase-1a-debug-echo.spec.md`](./phase-1a-debug-echo.spec.md), [`phase-1b-read-only-loads.spec.md`](./phase-1b-read-only-loads.spec.md), [`phase-1c-stateful-booking.spec.md`](./phase-1c-stateful-booking.spec.md) y [`phase-1d-hardening-faults.spec.md`](./phase-1d-hardening-faults.spec.md) como instrucciones normativas.
- [ ] [`phase-1-ltms-tcp-adapter.spec.md`](./phase-1-ltms-tcp-adapter.spec.md) es únicamente el umbrella/superseded routing spec; no debe usarse como instrucción monolítica.
- [ ] El ejecutor mantiene el stack Next.js App Router + TypeScript estricto + Vitest Node y no añade red externa, TMS real, FMCSA o HappyRobot.

## Files / Modules

- [ ] `phase-1a-debug-echo.spec.md` — checkpoint mínimo de extremo a extremo.
- [ ] `phase-1b-read-only-loads.spec.md` — lectura de cargas y contrato de dataset.
- [ ] `phase-1c-stateful-booking.spec.md` — booking local con estado y resultado incierto.
- [ ] `phase-1d-hardening-faults.spec.md` — endurecimiento, fault injection y matriz integral.
- [ ] `phase-1-ltms-tcp-adapter.spec.md` — índice de compatibilidad y routing superseded.

## Module Boundaries / Contracts

- [ ] **1A** posee el primer contrato público: `POST /api/tms/echo` con `{ "message": string }`, wire `DEBUG_ECHO`/`MSG`, conexión nueva por request y envelope HTTP estable.
- [ ] **1B** añade exclusivamente `POST /api/tms/loads/search` y `POST /api/tms/loads/detail`, ambos read-only; no añade booking ni fault injection configurable.
- [ ] **1C** añade exclusivamente `POST /api/tms/loads/book` y el estado mutable del mock; reutiliza codec, parser, cliente, errores y mapeo HTTP sin duplicarlos.
- [ ] **1D** conserva los contratos públicos y endurece framing, límites, lifecycle, errores, logging, mock y pruebas sin integrar un TMS real.
- [ ] `CMD` es el primer campo de request, `AUTH` es obligatorio, los values no contienen `|`, CR o LF y la request termina en CRLF. La validación sintáctica no debe convertirse en allowlist semántica rígida.
- [ ] La respuesta HTTP usa `{ "ok": true, "data": ... }` o `{ "ok": false, "error": { "type", "code", "message", "retryable" } }`, sin stack ni secretos.

## Extraction Plan

- [ ] Entregar codec/builder, parser incremental, transporte, cliente, configuración, errores, validación HTTP, mappers, servicio y mock como responsabilidades separadas a medida que cada fase los necesite.
- [ ] Centralizar límites, nombres wire, códigos remotos, status mapping, formatting y redacción de logs; no duplicar literales entre handlers y tests.
- [ ] Mantener `MAX_BUY` en el ámbito interno únicamente desde 1B; `NOTES` forma parte del DTO público de cargas, pero nunca aparece completa en logs ni metadata diagnóstica.
- [ ] Mantener el mock independiente del cliente productivo y proporcionar seams para probar el cliente sin sockets cuando sea apropiado.

## Modularity Risks

- [ ] 1A no debe crear un módulo god, un servicio/domain layer innecesario ni preparar handlers futuros antes de tiempo.
- [ ] No adelantar en 1A la matriz completa de framing, dataset completo, booking o fault injection configurable.
- [ ] No permitir que la ampliación de 1B–1D engorde handlers, `client.ts`, parser o mock con responsabilidades ajenas.
- [ ] No alterar el contrato público para acomodar abstracciones internas: en particular, `search` no debe exigir un wrapper genérico `{ filter: ... }`.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] No aplica Visual Fidelity. No usar Figma, no crear UI y no ejecutar revisión visual.

## Technical Approach

1. Construir en 1A el vertical slice mínimo `echo route → codec/parser → node:net → mock`.
2. Añadir en 1B únicamente lectura y transformación de cargas sobre la base estable de 1A.
3. Añadir en 1C booking stateful, con aislamiento y sin retry automático.
4. Reservar para 1D la matriz exhaustiva de faults, framing, carreras de lifecycle, límites y documentación final.

## Implementation Steps

1. Completar 1A y pasar su gate de echo, TCP, configuración, seguridad y tests esenciales.
2. Verificar que 1B parte de 1A sin romper `DEBUG_ECHO`; después añadir los dos endpoints read-only y sus tests.
3. Verificar 1B y añadir 1C con estado de mock aislado, booking ref/timestamp UTC y errores de negocio.
4. Ejecutar 1D como cierre técnico: hardening, fault injection configurable, matriz completa, validación final y README ampliado.

## Edge Cases

- [ ] Un gate posterior no puede degradar el comportamiento ya aceptado de una fase anterior.
- [ ] La ausencia de un filtro en `LOAD_QUERY`, una carga inexistente, una reserva duplicada y un timeout de booking conservan sus contratos de error definidos por la fase correspondiente.
- [ ] El EOF prematuro, la respuesta vacía válida (`END\r\n`) y los códigos remotos desconocidos deben distinguirse correctamente.
- [ ] Ninguna fase expone `AUTH`, `MAX_BUY`, secretos, stack traces ni `NOTES` completas en logs o metadata diagnóstica; `NOTES` se devuelve solo como campo del DTO público de cargas definido en 1B.

## Verification Plan

- [x] **Gate 1A:** instalación mínima, typecheck, tests esenciales, route echo, mock happy path/ERR, nuevo socket por request, cleanup y ausencia de secretos.
- [x] **Gate 1B:** ambos comandos read-only, DTO/mapping exactos, dataset requerido, parser de records múltiples/formato y no mutación.
- [x] **Gate 1C:** booking disponible→BOOKED, booking ref/timestamp UTC, conflictos/validaciones/errores y timeout sin retry.
- [x] **Gate 1D:** matriz exhaustiva builder/parser/client/routes/integration, fault injection, no handles abiertos, `typecheck`, `build`, `test`, `lint` y README final.
- [ ] Todas las verificaciones usan mock local, seams y puertos efímeros; nunca red externa.

## Rollback Plan

- [ ] Revertir por fase solo los archivos de implementación y configuración introducidos por esa fase; conservar todas las `.spec.md`.
- [ ] Mantener el último gate aprobado como baseline y no introducir fallback silencioso, retries o cambios de wire no documentados.
- [ ] Si una fase posterior no es viable, congelar el contrato de la fase anterior y registrar el bloqueo sin ampliar el scope de 1A.

## Acceptance Criteria

- [ ] El índice identifica claramente 1A–1D, sus dependencias, gates y no-goals.
- [x] Las fases 1A–1D están cerradas; Phase 1D es el checkpoint final de Phase 1.
- [ ] Todas las obligaciones del handoff original quedan redistribuidas y enlazadas en las cuatro specs de fase, sin requisitos eliminados.
- [ ] 1A permanece deliberadamente pequeña: solo echo, fundamentos mínimos, mock simple y pruebas esenciales.
- [ ] 1B, 1C y 1D enumeran explícitamente sus obligaciones completas, sin ejecutar prematuramente alcance de fases posteriores.
- [ ] La implementación debe seguir las specs incrementales y no el antiguo documento monolítico.
