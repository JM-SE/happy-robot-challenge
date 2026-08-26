# Fase 1 — LTMS TCP Adapter Umbrella / Superseded Routing Specification

## Context

El repositorio está vacío y el handoff original agrupaba en un único checkpoint el adaptador completo: echo, cargas, booking, hardening y fault injection. Este documento queda superseded como instrucción de implementación monolítica. Su función es preservar contexto, contratos globales y routing hacia las cuatro specs incrementales.

La implementación debe seguir, en orden, [`phase-index.spec.md`](./phase-index.spec.md) y las specs enlazadas:

1. [`phase-1a-debug-echo.spec.md`](./phase-1a-debug-echo.spec.md)
2. [`phase-1b-read-only-loads.spec.md`](./phase-1b-read-only-loads.spec.md)
3. [`phase-1c-stateful-booking.spec.md`](./phase-1c-stateful-booking.spec.md)
4. [`phase-1d-hardening-faults.spec.md`](./phase-1d-hardening-faults.spec.md)

## Dependencies / Inputs

- [ ] Next.js App Router, TypeScript estricto y Vitest en entorno Node.
- [ ] Dependencias mínimas; `node:net`; seam preparado para futuro `node:tls`, sin implementar TLS en esta fase.
- [ ] Mock TCP local configurable, puertos efímeros y ningún TMS real, FMCSA, HappyRobot, voice workflow o red externa.
- [ ] README mínimo desde 1A y documentación ampliada/final desde 1D. Este agente solo escribe specs; el ejecutor debe crear la documentación solicitada.

## Files / Modules

- [ ] Los archivos y módulos concretos se introducen por fase; consultar el breakdown de cada spec enlazada.
- [ ] Las rutas públicas acumuladas al cierre son `/api/tms/echo`, `/api/tms/loads/search`, `/api/tms/loads/detail` y `/api/tms/loads/book`.
- [ ] Los módulos acumulados incluyen config server-only, types, errors, protocol, parser, transport, client, servicio/mappers HTTP, logger y mock dataset/scenarios/CLI, siempre con el alcance incremental indicado.

## Module Boundaries / Contracts

- [ ] Todas las requests wire llevan `CMD` primero, `AUTH` obligatorio, campos separados por `|`, values sin `|`/CR/LF y CRLF final; el límite por defecto es 4096 bytes y no se trunca.
- [ ] El parser incremental usa `Buffer`, soporta records y terminales `END\r\n`/`ERR|CODE:<code>|MSG:<message>\r\n`, y distingue respuesta vacía de EOF incompleto.
- [ ] Cada llamada abre un socket nuevo, envía una request, usa connect/response timeouts, limpia de forma idempotente y no hace retries automáticos.
- [ ] El envelope HTTP es estable y seguro: éxito `{ok:true,data}`; error `{ok:false,error:{type,code,message,retryable}}`.
- [ ] El DTO público nunca incluye `MAX_BUY`; logs y metadata nunca contienen token, secretos, wire completo, números sensibles completos ni `NOTES` completas.

## Extraction Plan

- [ ] Aplicar el extraction plan de cada fase antes de ampliar la siguiente: codec/parser puros, IO aislado, validadores/mappers separados, reglas de estado internas y logger seguro.
- [ ] Centralizar constantes, límites, nombres wire, códigos remotos, formatting y HTTP mapping.
- [ ] Mantener el mock independiente del cliente productivo y con seams/fault scenarios explícitos.

## Modularity Risks

- [ ] No tratar este umbrella como permiso para implementar los cuatro handlers a la vez.
- [ ] No crear un `client` que combine codec, parser, timers, mappers, reglas de negocio y logging.
- [ ] No usar allowlist semántica rígida de commands que impida construir `UNKNOWN_CMD` sintácticamente válido.
- [ ] No convertir chunks Buffer a strings antes de resolver framing.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] No aplica Visual Fidelity. No hay UI, Figma, maquetación ni Playwright visual.

## Technical Approach

La estrategia normativa está en las cuatro specs de fase. Cada fase debe dejar un baseline verificable y agregar solo el contrato siguiente. Los requisitos completos del handoff original permanecen redistribuidos: 1A contiene el vertical slice, 1B lectura/dataset/parser de records, 1C booking/state, y 1D hardening/fault matrix/documentación final.

## Implementation Steps

1. Leer `phase-index.spec.md` y ejecutar solo 1A mientras sea el checkpoint vigente.
2. No comenzar una fase si no pasó su gate anterior.
3. Para cada fase, seguir sus pasos ordenados, edge cases, verification, rollback y acceptance criteria.
4. En caso de conflicto aparente, prevalece la spec incremental de la fase activa; cualquier cambio de contrato debe documentarse antes de implementarse.

## Edge Cases

- [ ] Fragmentación arbitraria, `END` separado, múltiples records, respuesta vacía, ERR básico y EOF incompleto se cubren desde las fases indicadas.
- [ ] Hardening exhaustivo de CR/LF aislado, framing, límites, terminales desconocidos y respuestas parciales se reserva a 1D.
- [ ] Booking con timeout tiene resultado incierto y nunca se reintenta automáticamente.
- [ ] `MAX_BUY` queda internal-only y no se implementa negociación completa.

## Verification Plan

- [ ] Usar los planes de verificación de 1A, 1B, 1C y 1D, no una suite monolítica adelantada.
- [ ] El cierre 1D debe pasar typecheck/build/test/lint, comprobar teardown sin handles abiertos y ampliar README.
- [ ] No validar contra TMS real, FMCSA, HappyRobot ni deployment.

## Rollback Plan

- [ ] Revertir cambios de implementación por fase y conservar los documentos de especificación.
- [ ] Mantener el último gate aprobado; no introducir fallback, pooling, TLS o retries como reparación implícita.

## Acceptance Criteria

- [ ] Este archivo ya no contiene instrucciones monolíticas conflictivas.
- [ ] Apunta a las cuatro specs incrementales y explica el orden obligatorio.
- [ ] Ningún requisito original desaparece: está cubierto por una fase enlazada o por el contrato global preservado aquí.
- [ ] La implementación respeta no UI, no TMS real/FMCSA/HappyRobot, no pooling, no retries, no negociación completa de `MAX_BUY` y no deployment productivo.
