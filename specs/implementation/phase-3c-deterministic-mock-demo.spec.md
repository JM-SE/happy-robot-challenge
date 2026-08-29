# Phase 3C — Deterministic Mock Demo Specification

## Context

Phase 2 is committed at `048ae3f` and safety-closed. Phase 3A is committed at `8b77734`; Phase 3B is committed at `73205d4`. The authoritative sequencing and safety constraints are in [`phase-3-index.spec.md`](./phase-3-index.spec.md) and [`phase-3b-endpoint-domain-contracts.spec.md`](./phase-3b-endpoint-domain-contracts.spec.md).

Real TMS traffic and real `LOAD_BOOK` have never been executed. This phase may activate only an explicit, demo-labeled mock booking path when `ADAPTER_MODE=mock`. Mock success is a deterministic local workflow result, not provider evidence, authorization, or proof of a side effect.

HappyRobot owns voice, FMCSA, OTP, negotiation, handoff, extraction, and Twin. The adapter owns the authenticated HTTP boundary, validation, TMS translation, normalized contracts/errors, deterministic mock behavior, safety guards, and sanitized correlation logging.

### Goal

Make `POST /api/tms/loads/book` return a repeatable mock-demo result for an authenticated, valid request in mock mode while preserving the exact 3A/3B envelope, DTO, error, auth, correlation, and default-deny real-booking behavior. The implementation must be small, injectable, process-scoped, and incapable of reaching `TmsClient`, real capability, controlled booking, attempt ledger, or `LOAD_BOOK` transport.

### Scope

- Activate only the public mock booking scenario in `ADAPTER_MODE=mock`.
- Add a private mock-only booking port/store and pure scenario/rate decision logic.
- Preserve the existing `booking-contract.ts` public-result mapper and 3B public DTOs/error taxonomy.
- Keep search/detail on the existing read-only seams and preserve existing mock TCP/fault behavior.
- Add focused unit, route, configuration, leakage, and non-reachability tests.

### Explicit non-goals

- Real TMS connectivity, real `LOAD_BOOK`, production booking authority, or any real side effect.
- A direct or generic `bookLoad` service, real capability factory, controlled workflow, attempt ledger, unbooking, compensation, retry, rollback, or idempotency authority.
- HappyRobot-owned voice/FMCSA/OTP/negotiation/handoff/extraction/Twin systems.
- SDK/OAuth/accounts/payments/dashboard, deployment/health work (3E), distributed state, or final production approval.
- Rewriting the mature TCP client, parser, transport, deadline, limits, resource-control, policy, or mock-server paths.

## Dependencies / Inputs

- [ ] Phase 1/2 protocol, parser, transport, deadline, limits, resource, policy, controlled-workflow, and ledger protections remain authoritative.
- [ ] Phase 3A (`8b77734`) shared HTTP method/content-type/body-limit/request-ID/auth pipeline and response envelopes.
- [ ] Phase 3B (`73205d4`) strict request DTOs, public allowlists, named bounds, domain errors, centralized HTTP mapping, and private mock contract.
- [ ] `ADAPTER_MODE=mock` remains the safe default; `ADAPTER_SHARED_SECRET` remains required.
- [ ] `REAL_BOOKING_ENABLED` is absent or exactly `false`; any other value fails closed.
- [ ] No credentials, real hostnames, real TMS tokens, MC values, raw frames/lines, stacks, or production approval are required or permitted.

## Invariants / Requirements

- [ ] A client cannot select mode or enable booking through a body field, query parameter, request header, request ID, or other request-controlled value.
- [ ] In `ADAPTER_MODE=real`, an authenticated valid booking request returns stable `403 REAL_BOOKING_DISABLED` before client, capability, controlled-workflow, ledger, mock-state, upstream, or transport access.
- [ ] Mock success is labeled with `data.booking.mode: "mock"` and `data.booking.demo: true` and is never described as provider/side-effect evidence.
- [ ] Public output is constructive and closed; no MC, `maxBuy`, notes, raw record, `rawLine`, token, stack, TCP detail, or internal policy explanation crosses the boundary or enters logs.
- [ ] Booking is no-retry and one-shot in intent. Preserve `rollbackAvailable=false`; do not add compensation or uncertain-attempt handling.
- [ ] Existing Phase 1/2 and 3A/3B read, parser, transport, deadline, limit, cleanup, policy, and mock fault behavior remains intact.
- [ ] The route only orchestrates pipeline/validation/config/port/mapping. Auth, validation, state, domain policy, mapping, logging, and IO must remain separately testable.

## User / Integration Behavior

All rows below assume a POST with `Content-Type: application/json`, a valid adapter key, and a valid request ID unless stated otherwise. Every response retains `meta.requestId` and the existing no-store/security response headers.

### Scenario matrix

| Scenario | Request/configuration | Exact outcome |
| --- | --- | --- |
| Successful mock booking | Mock mode; `{loadId:"LOAD-1002",mc:"demo-mc",agreedRate:2900}` | `200`; `{ok:true,data:{booking:{bookingRef:"BOOK-LOAD-1002",loadId:"LOAD-1002",agreedRate:2900,bookedAt:<fixed ISO demo marker>,mode:"mock",demo:true}},meta:{requestId}}`. Exactly the allowlisted fields are present. |
| Unknown load | Mock mode; valid shape with an unknown `loadId` | `404 LOAD_NOT_FOUND`; no state mutation and no upstream access. |
| Valid but unacceptable rate | Mock mode; known load with a finite, positive, bounded, two-decimal rate that the private demo scenario rejects, such as `LOAD-1002` at `2800` or `LOAD-1001` at its offered `2450` | `422 RATE_NOT_ACCEPTED`; no reason, ceiling, `maxBuy`, or notes are disclosed and state is unchanged. The only accepted happy-path fixture is `LOAD-1002` at `2900`. |
| Repeated/already booked request | After a successful mock booking, any valid repeat for that `loadId`, including a different `mc` or rate | `409 BOOKING_CONFLICT`; no second result, overwrite, retry, unbooking, or state change. |
| Concurrent requests | Multiple authenticated, valid identical requests for the same available `LOAD-1002` issued together | At most one `200` success; every other request returns `409 BOOKING_CONFLICT`. The transition is atomic for event-loop/Promise concurrency. |
| Malformed JSON | Body cannot be parsed as JSON | `400 MALFORMED_JSON`. |
| Invalid request shape/value | Non-object/array, unknown key, missing `loadId`/`mc`/`agreedRate`, wrong type, framed text, empty/overlong text, non-finite/non-positive/over-limit/over-precision rate | `400 VALIDATION_ERROR`; no domain, state, client, or upstream access. The public request is exactly `{loadId,mc,agreedRate}`. |
| Invalid request ID | Supplied `X-Request-ID` violates the 3A bounded pattern | `400 VALIDATION_ERROR`; generated context ID may appear in `meta`, with no request-body leakage. |
| Missing/invalid adapter auth | Missing or incorrect `X-Adapter-API-Key` | `401 ADAPTER_UNAUTHORIZED`; body parsing and booking dependencies are not reached. Adapter auth remains distinct from TMS auth. |
| Unsupported transport | Non-POST method, wrong/missing JSON content type, or body over the configured HTTP limit | `405 METHOD_NOT_ALLOWED`, `415 UNSUPPORTED_MEDIA_TYPE`, or `413 REQUEST_TOO_LARGE` respectively; no booking dependency is reached. `GET /api/tms/loads/book` remains `405`. |
| Real mode | `ADAPTER_MODE=real`, `TMS_MODE=real`, safe booking flag, valid authenticated request | `403 REAL_BOOKING_DISABLED`; no `TmsClient`, real capability, controlled booking, ledger, mock store, upstream socket, or `LOAD_BOOK` call. |
| Unsafe configuration | Invalid mode, mode/TMS mismatch, missing secret at config boundary, or `REAL_BOOKING_ENABLED` other than exactly `false` | Configuration loading fails closed. With independently valid adapter auth, the route returns `503 CONFIGURATION_UNAVAILABLE`; a missing adapter secret necessarily fails the HTTP auth boundary as `401 ADAPTER_UNAUTHORIZED`. No booking dependency is reached. |
| Server restart/fresh process | Repeat the previously successful mock request after process restart or a fresh internal factory/store | The process-scoped state is reset to `AVAILABLE`; the request may succeed again with the same deterministic reference and fixed demo timestamp. This is not idempotency or distributed authority. |

Error messages remain the stable centralized safe messages from `http-contract.ts`, and all error envelopes are `{ok:false,error:{code,message,retryable:false},meta:{requestId}}`.

## Mock State and Transition Semantics

### State model

- Use a dedicated mock-only store keyed by `loadId`, created behind an internal factory. The production route may use one process-scoped instance; tests must be able to create a fresh isolated instance.
- Each entry needs only the availability/booking state and deterministic booking metadata needed to return the result. Do not persist `mc`, carrier identity, raw records, notes, `maxBuy`, or request payloads.
- Initialize known IDs from the safe public portions of `LOAD_DATASET`. The store is not the `mock/ltms-server` state and must not be coupled to the TCP server lifecycle.
- There is no public reset endpoint. Test reset means constructing a new internal store/factory, not mutating production state through an HTTP escape hatch.

### Transition rules

1. Strict DTO validation completes before the port is called.
2. The mock port resolves the load identity from the private catalog. Unknown identity yields `LoadNotFoundError` and does not create state.
3. A booked entry yields `BookingConflictError` before any repeat operation can overwrite it. Once a successful transition occurs, all later attempts for that ID are conflicts.
4. An available entry is checked by a pure mock scenario/domain validator. The demo accepts only the deterministic `LOAD-1002` / public offered rate `2900` scenario. Exact public offered-rate matching is required; any other valid known-load scenario, including `LOAD-1001` at its offered `2450`, is `RateNotAcceptedError`. The private fixture may use its internal rejection relationship, but no implementation may expose or log why it was rejected.
5. Only an accepted available entry transitions once from `AVAILABLE` to `BOOKED`, with `bookingRef=BOOK-${loadId}` and a named fixed ISO demo marker such as `DEMO_BOOKED_AT="2000-01-01T00:00:00.000Z"`. `bookedAt` is not wall-clock identity.
6. Unknown, conflict, and rate-rejected paths do not mutate state. No error path retries, reserves temporarily, compensates, rolls back, or calls an external system.

### Concurrency and atomicity

- The availability check and successful `AVAILABLE -> BOOKED` mutation must occur in one synchronous critical section with no await or external IO between them. If the port remains Promise-shaped, reserve before resolving the Promise.
- `Promise.all` tests must prove exactly one success for simultaneous identical requests and deterministic conflicts for the rest. A lock, queue, or distributed primitive is not needed for the single-process demo, but an implementation must not create a check-then-await race.
- A rejected-rate request must not consume availability; a later accepted request can still be the one success.

### Determinism, lifetime, and isolation

- Booking reference is identity: `BOOK-${loadId}`. It is stable across fresh runs.
- `bookedAt` is the named fixed ISO demo marker, not `new Date()` and not a uniqueness source.
- State lasts only for the current Node process and internal store instance. Restart, test teardown, or fresh factory construction resets it.
- Tests must not share a mutable singleton across cases. Route tests should inject or replace the internal factory through a test-only seam without making that seam public.
- The mock port is a demo simulation only; it is not idempotency, distributed coordination, provider availability, booking evidence, or production authorization.

### Data sensitivity

- `mc` is accepted only at the private input boundary and is erased before result mapping, state persistence, logging, and errors.
- `maxBuy`, notes, internal mock records, `MockBooking`, `LoadInternal`, raw TCP lines/frames, tokens, stacks, and internal policy decisions remain private.
- Public data and logs may contain only the approved booking fields and bounded correlation/operational metadata. Never log the request body, MC, rate-policy internals, or raw error text.

## Exact 3B Public Contract Preservation

### Request

`POST /api/tms/loads/book` accepts exactly `{loadId,mc,agreedRate}`. `loadId` and `mc` are bounded safe text; `agreedRate` is a JSON number, finite, positive, at most two decimal places, and no greater than `MAX_PUBLIC_RATE`. Unknown fields and aliases such as `mcNumber`, `maxBuy`, workflow fields, idempotency fields, or mode flags remain invalid.

### Success output allowlist

The only successful booking object is `data.booking` with exactly:

- `bookingRef`
- `loadId`
- `agreedRate`
- `bookedAt`
- `mode: "mock"`
- `demo: true`

Use the existing `toPublicBookingResult` mapper or a minimal compatible reuse. Construct output field-by-field. Never add `mc`, `mcNumber`, `maxBuy`, notes, raw records, `rawLine`, tokens, stacks, TCP fields, provider evidence, or policy data.

### Error/status contract

| Condition | Status/code | Retryable |
| --- | --- | --- |
| Invalid shape/value | `400 VALIDATION_ERROR` | `false` |
| Malformed JSON | `400 MALFORMED_JSON` | `false` |
| Invalid adapter auth | `401 ADAPTER_UNAUTHORIZED` | `false` |
| Unknown load | `404 LOAD_NOT_FOUND` | `false` |
| Method/content type/body limit | `405 METHOD_NOT_ALLOWED`, `415 UNSUPPORTED_MEDIA_TYPE`, `413 REQUEST_TOO_LARGE` | `false` |
| Real booking disabled | `403 REAL_BOOKING_DISABLED` | `false` |
| Already booked/repeat/concurrent loser | `409 BOOKING_CONFLICT` | `false` |
| Valid mock rate rejected | `422 RATE_NOT_ACCEPTED` | `false` |
| Unsafe server configuration | `503 CONFIGURATION_UNAVAILABLE` | `false` |

Use the centralized `http-contract.ts` mapper and stable public messages. Do not add route-local status tables or copy exception/remote text. `TMS_AUTH_FAILED` remains a `502` read/upstream concern and is not an adapter-auth or mock-booking success condition.

## Files / Modules and Responsibility Boundaries

| Location | Responsibility and boundary |
| --- | --- |
| `src/tms/mock-booking-store.ts` (recommended) | Private process-scoped state keyed by `loadId`; fresh factory for tests; atomic transition storage; no HTTP, config, TMS client, MC persistence, or logging. |
| `src/tms/mock-booking-scenarios.ts` (recommended) | Pure catalog lookup and deterministic accepted/rejected-rate decision. May consume safe fixture values internally; returns typed domain decisions/errors, never internal policy reasons. |
| `src/tms/mock-booking-port.ts` (recommended) | Explicitly mock-only injectable port and internal factory composing the scenario validator and store. No `TmsClient`, real capability, controlled booking, ledger, transport, or generic `bookLoad` export. |
| `src/tms/booking-contract.ts` | Private `MockBookingPort`/`MockBookingResult` contract and `toPublicBookingResult`; preserve the six-field public result allowlist. Keep these internal-only even if type-exported for tests. |
| `src/tms/public-contracts.ts` | Existing strict public request/result types and named bounds; no IO, state, config lookup, or logging. Do not add fields. |
| `src/tms/domain-errors.ts` | Existing `LoadNotFoundError`, `BookingConflictError`, and `RateNotAcceptedError`; no raw internal messages at the HTTP boundary. |
| `src/tms/http-contract.ts` | Existing method/auth/body/correlation pipeline, envelopes, centralized status/code/message mapping, and safe headers. Extend only if a typed 3C error needs mapping; do not duplicate mapping in the route. |
| `src/tms/adapter-config.ts` | Server-only mode and fail-closed unsafe configuration. Keep `realBookingEnabled: false`; no client override. |
| `app/api/tms/loads/book/route.ts` | Thin orchestration: parse strict DTO, load config, deny real mode, obtain internal mock port in mock mode, invoke it, map result, and return through the shared handler. No state, business-rule table, TCP/HTTP IO, or logging implementation. |
| `mock/dataset.ts` | Safe source for the two deterministic fixture identities and public offered values. Do not expose its internal fields or reuse its MC-bearing/dynamic-timestamp booking result as the public contract. |
| `mock/ltms-server.ts` | Existing TCP query/get/book mock and fault delivery. Preserve untouched for existing TCP integration/regression tests; the public 3C route must not call it. |
| Existing search/detail routes | Preserve existing 3B read-only `TmsClient`/service pipeline, public shapes, bounds, and mapper behavior. Do not synchronize them with the dedicated booking store in 3C. |
| Focused tests | Keep pure state/scenario tests separate from route/envelope/auth tests and static safety checks. Do not add real TMS or real booking tests. |

### Export/privacy rules

`MockBookingPort` and `MockBookingResult` are internal implementation contracts, not public API. They may be type-imported by the route and focused tests only; do not re-export them through public contracts or a barrel. Do not export a generic `bookLoad`, a real-booking substitute, a mutable store singleton, `LoadInternal`, `MockBooking`, `LoadBookingState`, `maxBuy`, notes, MC-bearing records, ledger/capability types, or a reset function.

Do not use an `export *` barrel that makes internal mock or real-booking symbols reachable. Static checks must prove the public route has no import path to real capability, controlled booking, attempt ledger, real runner, or `LOAD_BOOK` transport.

## Module Boundaries / Contracts

- **HTTP entrypoint:** `Request -> handleAdapterRequest -> endpoint handler`; 3A performs method, request ID, auth, content type, size, JSON parsing, envelope, and correlation behavior.
- **DTO boundary:** `unknown -> PublicBookingRequest`; exact keys, types, bounds, and safe text are enforced before config/domain work.
- **Mode boundary:** `PublicBookingRequest + server-only AdapterConfig`; real mode returns `REAL_BOOKING_DISABLED` without constructing or touching any booking dependency; mock mode alone may obtain the internal mock port.
- **Mock domain boundary:** `PublicBookingRequest -> typed domain result/error`; scenario validation and state transition do not know HTTP status codes, headers, envelopes, or log formats.
- **Result boundary:** private mock result -> `toPublicBookingResult` -> six-field public booking DTO; no object spread or protected fields.
- **Error boundary:** typed validation/config/domain errors -> one `http-contract.ts` mapper -> stable status/code/message/retryability and request ID.
- **Logging boundary:** only bounded command/request ID/duration/outcome/error metadata; never request body, MC, raw records, notes, `maxBuy`, TCP data, or stacks.

### Mock booking data flow

1. Request enters the shared 3A POST/JSON/size/request-ID/auth pipeline.
2. Strict 3B booking DTO parsing produces only `{loadId,mc,agreedRate}`; invalid input stops here.
3. Server-only adapter config is checked. Unsafe config fails closed. Real mode stops with `403 REAL_BOOKING_DISABLED` before any booking dependency.
4. Mock mode obtains the internal process-scoped port from its factory.
5. The port performs private catalog lookup, deterministic rate decision, atomic state transition, and fixed-result construction without external IO.
6. A typed result is mapped through the 3B public mapper; a typed error is mapped through the centralized HTTP contract.
7. The shared envelope includes only the allowlisted data/error and bounded `meta.requestId`; sanitized correlation metadata may be logged.

### Real-mode data flow

`Request -> shared pipeline -> strict DTO -> server-only config -> stable 403`. It must not construct or access `TmsClient`, `TmsClient` configuration, mock booking state, real capability, controlled workflow, attempt ledger, TCP transport, upstream, or `LOAD_BOOK`.

## Integration Points: Reuse vs. Preserve

- **`mock/dataset.ts`:** reuse only safe catalog identity/offered-rate data for deterministic scenarios; pin `LOAD-1002`/`2900` as the sole success fixture and use `LOAD-1001`/`2450` as a deterministic rejection fixture. Do not expose `maxBuy`, `notes`, MC, or raw records. Do not use `bookLoadInState` for the public route because it returns MC, uses a wall-clock timestamp, and expresses internal acceptance semantics that are not the 3B public demo contract.
- **`mock/ltms-server.ts`:** leave query/get/book dispatch, state, fault delivery, fragmentation, delays, malformed responses, timeouts, and cleanup unchanged. Its `LOAD_BOOK` is a local TCP test fixture only and is not an authorization to connect from the route.
- **`src/tms/booking-contract.ts`:** reuse the private port/result typing and `toPublicBookingResult`; keep the public mapper field allowlist and demo labels. Strengthen validation only through the existing typed boundary, not by widening output.
- **`src/tms/public-contracts.ts`:** preserve `PublicBookingRequest` and `PublicBookingResult`, `MAX_PUBLIC_RATE`, `MAX_PUBLIC_MC_LENGTH`, and all 3B names. No `mcNumber`, currency, idempotency, workflow, or mode fields.
- **`src/tms/domain-errors.ts`:** use `LoadNotFoundError`, `BookingConflictError`, and `RateNotAcceptedError`; do not encode `maxBuy` or private scenario details in messages.
- **`src/tms/http-contract.ts`:** use `handleAdapterRequest`, `successResponse`, `publicErrorResponse`, and centralized mappings. Preserve `401` adapter auth, `403` real-disabled, `404` not-found, `409` conflict, `422` rate rejection, and `503` configuration semantics.
- **`app/api/tms/loads/book/route.ts`:** replace only the mock-mode 3B denial with the internal mock-port orchestration. Keep real-mode denial, exact route, runtime, GET/unsupported-method behavior, and shared handler.
- **Existing read routes:** retain the 3B `searchLoads`/`getLoad` client seams and public mappers. Do not make reads bypass the pipeline, read the booking store, or change public fields. A later decision may add an isolated demo read adapter if post-booking status is required; it is not part of 3C.
- **Phase 1/2 policy/controlled/ledger/real modules:** remain untouched and unreachable from 3C mock booking. In particular, do not weaken `rollbackAvailable=false`, no-retry, target, authority, evidence, or approval protections.

## Test Plan

### Pure mock port/store/scenario tests

- [ ] Fresh stores initialize known loads as available and do not persist MC, notes, `maxBuy`, or raw records.
- [ ] `LOAD-1002` at `2900` returns the same six-field result on a fresh run, including the same `BOOK-LOAD-1002` and fixed ISO marker.
- [ ] Unknown load returns `LoadNotFoundError`; valid unacceptable rates return `RateNotAcceptedError`; rejected attempts do not consume availability.
- [ ] One successful transition occurs for an available load; repeats return `BookingConflictError` and cannot overwrite the reference/timestamp.
- [ ] `Promise.all` concurrent booking tests prove one success at most and conflict for every loser.
- [ ] Tests assert exact private/public keys and prove MC never appears in state, result, error, or captured log metadata.
- [ ] New store/factory construction resets state; no public reset or process-global test leakage exists.

### HTTP route/contract tests

- [ ] Mock success preserves `{ok,data,meta}`, `data.booking` allowlist, `mode:"mock"`, `demo:true`, deterministic reference, fixed marker, and request-ID header/meta.
- [ ] Unknown, unacceptable-rate, repeat, and concurrent outcomes map exactly to `404 LOAD_NOT_FOUND`, `422 RATE_NOT_ACCEPTED`, and `409 BOOKING_CONFLICT` with `retryable:false`.
- [ ] Malformed JSON, invalid strict DTO, invalid request ID, missing/invalid auth, unsupported method/content type, and over-limit body map to the exact 3A statuses/codes.
- [ ] Real-mode valid booking returns `403 REAL_BOOKING_DISABLED`; spies prove zero client, capability, controlled-booking, ledger, mock-state, upstream, socket, and `LOAD_BOOK` access.
- [ ] Authenticated route tests include supplied and generated request IDs and assert no body/MC/internal fields in success, errors, headers, or logs.

### Configuration, leakage, and regression tests

- [ ] Invalid mode, mode/TMS mismatch, missing secret at the config function, and unsafe `REAL_BOOKING_ENABLED` values fail closed; route/config tests distinguish missing-secret `401` at HTTP auth from `503 CONFIGURATION_UNAVAILABLE` for otherwise authenticated unsafe configuration.
- [ ] Static/import checks prove no public route imports real capability, controlled booking, attempt ledger, real runner, direct mutation seam, or exported `bookLoad`; no request/env/header/query bypass exists.
- [ ] Public JSON and log-capture tests reject `mc`, `mcNumber`, `maxBuy`, notes, rawLine, tokens, stacks, TCP details, internal messages, and provider-evidence claims.
- [ ] Existing TCP mock query/get/book, fragmented/delayed/malformed/timeout/cleanup/fault, no-retry, and post-write fault tests remain green.
- [ ] Existing parser, transport, deadline, limits, resource-control, policy, controlled-workflow, ledger, and read-only service regressions remain green.
- [ ] Do not add, configure, or execute real TMS tests, real `LOAD_BOOK` tests, production credentials, or real-provider smoke calls.

## Implementation Order

1. Confirm the 3A/3B contract and freeze the deterministic scenario table, named demo timestamp, and protected-field allowlist.
2. Add pure private scenario/catalog decision logic and a minimal process-scoped store with fresh test construction.
3. Add the explicitly mock-only port/factory and typed error/result integration; keep internal exports closed.
4. Replace only the mock branch of the booking route: strict DTO -> config/mode guard -> mock port -> public mapper -> shared envelope.
5. Add route, concurrency, request-ID/auth, configuration, static reachability, and leakage tests.
6. Run existing mock/TCP and Phase 1/2 regression tests without invoking any real runner or real `LOAD_BOOK`.
7. Review the diff and import graph for capability reachability, protected data, retries, rollback changes, and read-route drift.

## Verification Plan

Run only repository-local verification that does not contact a real TMS or execute real `LOAD_BOOK`:

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Run the focused 3C unit/route/config/static/leakage tests as part of the local test suite.
- [ ] Confirm no `npm run test:real-tms:*`, real TMS script, production credential, real host, or real `LOAD_BOOK` operation was run.
- [ ] Inspect changed exports, route imports, public JSON, captured logs, and configuration branches manually.

## Acceptance Criteria

- [ ] An authenticated valid mock request for `LOAD-1002` at public offered rate `2900` returns a `200` demo-labeled booking with exactly the 3B allowlisted fields.
- [ ] Unknown, valid-but-unacceptable, repeated, and concurrent requests return exactly `404 LOAD_NOT_FOUND`, `422 RATE_NOT_ACCEPTED`, and `409 BOOKING_CONFLICT` as specified; only one concurrent request can succeed.
- [ ] The request remains exactly `{loadId,mc,agreedRate}` and strict 3A/3B validation/auth/content-type/body/request-ID behavior is preserved.
- [ ] Mock state is process-scoped, keyed only by load ID, atomically transitioned once, reset by fresh process/factory, and not presented as idempotency or distributed authority.
- [ ] `bookedAt` is a named fixed ISO demo marker and `bookingRef` is `BOOK-${loadId}`; no wall-clock identity or MC persistence exists.
- [ ] Real mode always returns `403 REAL_BOOKING_DISABLED` for valid authenticated booking input before any booking/client/upstream/ledger/capability/state access, and no request/config value can bypass it.
- [ ] Unsafe configuration remains fail closed; `REAL_BOOKING_ENABLED` cannot become true and `rollbackAvailable=false`/no-retry protections remain unchanged.
- [ ] No public response, error, or log contains MC, `maxBuy`, notes, raw records/rawLine, tokens, stacks, TCP details, or internal policy information.
- [ ] `mock/ltms-server.ts`, existing read routes, mature TCP/parser/transport/deadline/limit/resource/policy/controlled/ledger paths, and their regression tests remain intact.
- [ ] The implementation is decomposed into focused port/store/scenario/mapper/config/route/test units; no monolithic route combines auth, parsing, state, domain rules, mapping, logging, and IO.
- [ ] Required local verification passes without any real TMS or real `LOAD_BOOK` execution, and no commit is created unless separately requested.

## Risks / Safety / Rollback

- **Mock mistaken for authority:** Keep `mode:"mock"`, `demo:true`, fixed synthetic timestamp, and documentation that success is not provider evidence. Never call the result a confirmed load booking outside the demo contract.
- **Real escape hatch:** Keep real mode as an early stable denial, avoid all real/capability/ledger imports, and stop/report `BLOCKED` if any change makes real `LOAD_BOOK` reachable.
- **State race:** Make check-and-transition synchronous/atomic and prove it with `Promise.all`; do not add an await between availability check and reservation.
- **State leakage:** Keep the store process/test scoped, provide only an internal fresh factory, and do not add a reset endpoint or distributed implication.
- **Sensitive-data leakage:** Use private narrow types and constructive mapping; add static and log-capture checks. Never reuse the MC-bearing `MockBooking` as a public result.
- **Mock/read divergence:** Do not mutate the existing TCP mock or read routes. If a status-synchronization requirement appears, stop and capture it as a separate decision/phase.
- **Rollback:** If 3C is unsafe or regressions appear, remove only the mock-route activation and restore the 3B `POLICY_DENIED` behavior while preserving 3A, Phase 1/2, config fail-closed behavior, and tests. Do not add a fallback real path, retry, unbooking, compensation, rollback, or `rollbackAvailable=true`.

## Open Questions

These are non-blocking for 3C and must never weaken the guards above:

- Should demo booking state eventually be shared or distributed across Railway instances? **Default for 3C: no; retain process/test scope.**
- Should `bookedAt` remain fixed or become generated for a later UX? **Default for 3C: fixed synthetic ISO marker; any later change is an explicit contract decision.**
- Should public mock read detail/search reflect the dedicated demo booking state? **Default for 3C: no; retain existing read seams and shapes, and decide in a later isolated phase.**
- Who owns final production booking authority, target/egress, evidence, and approval? **Default: a separately named post-3C approval; mock success cannot satisfy it.**

## Handoff to `@coder-heavy`

Implement only Phase 3C from this specification. Modify product/source/test files only as required by this handoff, do not commit unless requested, and do not execute any real TMS operation or real `LOAD_BOOK`. Stop and report immediately if a proposed change makes real booking reachable, introduces a generic/direct booking seam, weakens default-deny/no-retry/`rollbackAvailable=false`, changes mature TCP/read behavior unnecessarily, or exposes MC, `maxBuy`, notes, raw payloads, tokens, stacks, or TCP details.
