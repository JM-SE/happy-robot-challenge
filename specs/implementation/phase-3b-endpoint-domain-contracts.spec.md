# Phase 3B — Endpoint and Domain Contracts Specification

## Context

Phase 1 is complete; Phase 2 is committed at `048ae3f` and its safety gates are closed. Phase 3A is implemented at `8b77734` and supplies the authenticated, bounded, correlated JSON boundary. Real TMS traffic and real `LOAD_BOOK` have never been executed and must remain unreachable/disabled through 3B.

3B finalizes the transport-independent public DTOs and normalized domain semantics for search, detail, and booking. HappyRobot owns voice, FMCSA, OTP, negotiation, handoff, extraction, and Twin. The adapter owns HTTP/domain DTO validation, TMS translation, normalized data/errors, deterministic mock boundaries, correlation, and real-booking protection.

### Scope

- Finalize strict request DTOs and closed response DTOs for `POST /api/tms/loads/search`, `POST /api/tms/loads/detail`, and `POST /api/tms/loads/book`.
- Finalize normalized domain error taxonomy and its mapping through the shared Phase 3A HTTP contract.
- Preserve the stable 3A echo route through regression coverage only.
- Define the private, explicitly mock-scoped booking port/result seam that 3C may exercise; do not activate public mock booking in 3B.

### Non-goals

- No real provider authority, real transport path, real TMS `LOAD_BOOK`, direct `bookLoad` service seam, or production booking capability.
- No public mock-booking success path if that behavior belongs to 3C; `/api/tms/loads/book` remains denied.
- No FMCSA or OTP provider, voice, Twin, SDK, OAuth, accounts/payments/dashboard, negotiation, or HappyRobot-owned handoff workflow.
- No pagination, idempotency key, currency field, invented search filters, API version prefix, health/deployment work, or production real-booking approval.

## Dependencies / Inputs

- [ ] [`phase-3-index.spec.md`](./phase-3-index.spec.md), authoritative Phase 3 sequencing and safety invariants.
- [ ] [`phase-3a-http-integration-contract.spec.md`](./phase-3a-http-integration-contract.spec.md), authoritative envelope, auth, correlation, bounded JSON, status, and route pipeline.
- [ ] Phase 1/2 TCP, parser, transport, deadline, limits, resource-control, policy, mock, and controlled-booking seams remain authoritative.
- [ ] `8b77734` 3A implementation and existing regression suite.
- [ ] No production credentials, real hostnames, tokens, MC values, raw frames/lines, stacks, or operational identifiers are needed or permitted.

## Repository Evidence

| Current location | Observed responsibility | 3B consequence |
| --- | --- | --- |
| `src/tms/http-contract.ts` | Shared request pipeline, envelopes, request IDs, and centralized public error mapping. | Extend the shared mapper for typed domain errors; do not add route-specific status maps or copy exception text. |
| `src/tms/http-dto.ts` | 3A exact HTTP request parsing and a `notes`-stripping helper. | Strengthen exact DTOs, defaults, bounds, and field-by-field output mapping; do not retain object-spread/public `LoadPublic` exposure. |
| `src/tms/service.ts` | Read-only `searchLoads` and `getLoad` over `LoadTmsPort`; no direct booking service seam. | Keep these as the only public search/detail service seams; do not reintroduce `bookLoad`. |
| `src/tms/loads.ts`, `src/tms/types.ts` | Internal TMS field translation and load types; `LoadInternal` includes `maxBuy`, and transitional public types include `notes`/unrestricted status. | Treat these as internal sources. Add a separate closed public contract and strict mapper. |
| `app/api/tms/loads/{search,detail,book}/route.ts` | Thin 3A handlers. Search/detail construct the read client; booking validates then denies before client/upstream access. | Preserve shared orchestration and strengthen it only through pure validators/mappers and the existing policy guard. |
| `src/tms/errors.ts` | Typed adapter, validation, remote, protocol, timeout, and configuration errors. | Add/extend typed domain errors without exposing internal messages; keep adapter `401` distinct from TMS `502`. |
| `src/tms/adapter-config.ts` | Server-only mode, required adapter secret, and permanently false real-booking flag. | Keep mock as the safe default; no request field/header/env value may select mode or enable booking. |
| `src/tms/policy.ts`, `src/tms/controlled-booking.ts`, `src/tms/real/`, `src/tms/attempt-ledger.ts` | Phase 2 policy, controlled workflow, real capability, and attempt/uncertainty safety boundaries. | Keep private/internal and unreachable from public 3B booking. Preserve `rollbackAvailable=false`. |
| `mock/dataset.ts`, `mock/ltms-server.ts` | Deterministic records and stateful mock `LOAD_BOOK` fault behavior for later use. | Do not expand the public mock demo in 3B; specify only the 3C seam and result contract. |

## Requirements

### Public request contracts

- [ ] All request objects are strict constructive allowlists: reject unknown keys, arrays, non-objects, missing required values, dangerous/framing text, and malformed types with existing stable `400 VALIDATION_ERROR` behavior.
- [ ] Search accepts exactly `originState`, `destinationState`, `equipmentType`, and `maxResults`. At least one of the first three filters is required. Reject date, city, ZIP, cursor, pagination, and all other fields. Trim and uppercase states/equipment; use safe bounded text; default omitted `maxResults` to named `DEFAULT_MAX_RESULTS` (`10`); accept only positive integers through existing `MAX_RESULTS_LIMIT` (`50`).
- [ ] Search filters use AND semantics. An upstream empty match is a successful `200` with `data.loads: []`; it is never `404`.
- [ ] Detail accepts exactly `loadId`, as bounded safe text with no framing characters. Perform one fresh exact-ID `getLoad` read; do not cache, use stale fallback, fabricate a record, or broaden the lookup. Unknown IDs map to `404 LOAD_NOT_FOUND`.
- [ ] Booking accepts exactly `loadId`, `mc`, and `agreedRate`. Do not accept `mcNumber`, `maxBuy`, internal ceiling, carrier profile, handoff, OTP, negotiation, or idempotency fields. `mc` is bounded opaque text (recommended maximum 64 characters), accepted only at the private boundary, and never returned or logged.
- [ ] `agreedRate` is a JSON number (not a numeric string), finite and positive, with at most two decimal places and named `MAX_PUBLIC_RATE` (`1,000,000`). Malformed shape/format is `400 VALIDATION_ERROR`; a later valid mock-domain rejection is `422 RATE_NOT_ACCEPTED`.
- [ ] No client-controlled mode switch, real-booking flag, header, query parameter, body field, or environment value exists.

### Public response contracts

- [ ] Preserve unversioned `/api/tms/...` paths and 3A `{ok,data,meta}` / `{ok:false,error,meta}` envelopes. 3B changes/finalizes only the `data` shapes below; add no aliases such as `mcNumber` and no backward-compatible invented search fields.
- [ ] `PublicLoadSummary` contains only `loadId`, `originState`, `destinationState`, `originCity`, `destinationCity`, `equipmentType`, `rate`, and optional `pickupDate`, `miles`, and known `status`.
- [ ] `PublicLoadDetail` has a separate type and mapping function, even if it currently contains the same safe fields as the summary.
- [ ] `rate` means the public offered rate only. It is never `maxBuy` or an internal ceiling. Never expose `notes`, `maxBuy`, raw records/rawLine, tokens, MC values, stacks, TCP details, or unapproved fields.
- [ ] Construct output field-by-field; never spread internal records or `LoadPublic`. Unknown/unapproved upstream fields are omitted. A recognized malformed required value, or malformed present optional value, fails closed as a safe upstream/protocol error rather than being silently defaulted, clamped, or coerced.
- [ ] Normalize states/equipment. Validate bounded safe strings, canonical `YYYY-MM-DD` pickup dates (named `MAX_PUBLIC_DATE_LENGTH=10`), finite positive `rate <= MAX_PUBLIC_RATE`, finite nonnegative `miles <= MAX_PUBLIC_MILES` (`10,000`), and only `AVAILABLE`/`BOOKED` status values. An unrecognized present date fails safely rather than passing through.
- [ ] The reserved 3C success shape is `data.booking` with `bookingRef`, `loadId`, `agreedRate`, `bookedAt`, `mode: "mock"`, and `demo: true`. `bookingRef` is deterministic as `BOOK-${loadId}`; server-generated ISO `bookedAt` is not identity. It never contains `mc`, `mcNumber`, `maxBuy`, notes, or policy data.

### Domain behavior and errors

- [ ] Search maps the strict public request to only the approved internal query fields, calls read-only `searchLoads`, sorts mapped results by ascending `loadId`, and applies the validated result bound at the domain boundary.
- [ ] Detail maps one exact `getLoad` result to one allowlisted object. `UNKNOWN_LOAD` maps to `404 LOAD_NOT_FOUND`.
- [ ] Keep booking shape validation separate from authorization/policy. In 3B, a valid request then stops at the policy guard before client construction, port access, upstream access, or state access. It returns `403 REAL_BOOKING_DISABLED` in real mode and `403 POLICY_DENIED` in mock mode. There is no successful 3B booking response.
- [ ] The reserved 3C errors are `409 BOOKING_CONFLICT` for already-booked/repeated/concurrent mock attempts, with no retry, and `422 RATE_NOT_ACCEPTED` for a valid offered rate rejected by mock domain policy. Messages never reveal `maxBuy` or an internal ceiling.
- [ ] Unknown detail/booking load maps to `404 LOAD_NOT_FOUND`; request shape/format remains `400 VALIDATION_ERROR`; adapter auth remains `401 ADAPTER_UNAUTHORIZED`; TMS auth remains `502 TMS_AUTH_FAILED`; unknown remote failures remain generic safe upstream errors; bounded timeout remains `504 TMS_TIMEOUT`.
- [ ] Reuse the centralized Phase 3A mapper and stable public messages. Never copy raw exception/remote text into a response.
- [ ] Future 3C mock state is process/test scoped and demo-labeled: one first success, repeat/concurrent conflict, deterministic reference, no automatic retry, compensation, unbooking, rollback, or real side effect. Any future controlled workflow preserves `rollbackAvailable=false`.
- [ ] Public booking is not a replacement for Phase 2C selection/detail/negotiation/FMCSA/OTP/handoff authorization; those HappyRobot-owned inputs remain outside adapter DTOs.

## Files / Modules

Names may adjust during implementation, but responsibilities and export boundaries must remain:

- [ ] `src/tms/public-contracts.ts` (or equivalent) — public request/result/error DTO types, named limits, and approved enums only; no IO, config lookup, policy, state, or logging.
- [ ] `src/tms/public-load-mapper.ts` (or equivalent) — pure, explicit summary/detail field-by-field mapping and upstream value validation; no request parsing, auth, policy, IO, or logging.
- [ ] `src/tms/booking-contract.ts` (or equivalent) — strict public booking request/result/error types and internal-to-public mapping; no real capability and no booking side effect.
- [ ] `src/tms/mock-booking-port.ts` (or equivalent, private/internal only if prepared) — the future 3C mock-only port contract; never a generic booking or real-capability factory and never imported by the 3B public route.
- [ ] `src/tms/domain-errors.ts` (or an extension of existing errors) — typed not-found, conflict, and rate-rejected domain errors; no raw public messages or transport IO.
- [ ] `src/tms/http-dto.ts` — strict endpoint request validators and public-to-internal translation, using centralized named limits; do not accept broader internal search fields at the public boundary.
- [ ] `src/tms/http-contract.ts` — shared 3A pipeline and centralized status/code/message mapping, extended for 3B domain errors only.
- [ ] `src/tms/service.ts` — retain read-only `searchLoads`/`getLoad` service and port seam. A future mock-booking port, if prepared, is private and explicitly mock-scoped, not a generic or real booking service.
- [ ] `app/api/tms/loads/{search,detail,book}/route.ts` — thin orchestration only; use the shared pipeline, pure validators/mappers, read-only service, and 3B default-deny booking guard.
- [ ] Existing `client.ts`, parser, transport, deadline, limits, resource-controls, `mock/`, policy, controlled workflow, ledger, and real capability modules — preserve and do not bypass or rewrite.

### Export/privacy boundary

Public exports may expose only the named public DTOs, enums, limits, pure validators, pure mappers, and stable domain-error identifiers needed by the HTTP contract. Keep `LoadInternal`, internal/transitional `LoadPublic`, `maxBuy`, `BookingInternal`, `TmsRecord`, `rawLine`, MC data, attempt ledgers, capabilities, authority, and real runners private/internal. Do not add an `export *` barrel that makes these reachable, and do not reuse the existing `BookingPublic` shape if it contains `mcNumber`.

## Module Boundaries / Contracts

- **HTTP entrypoint:** Phase 3A performs method/content-type/body-limit/request-ID/auth checks, then invokes one endpoint validator and one domain operation. Routes do not own IO, mapping, policy decisions, logging, or status tables.
- **Request DTO boundary:** `unknown -> PublicSearchRequest | PublicDetailRequest | PublicBookingRequest`; exact keys and normalization are enforced here. The booking `mc` value may only flow to a future private mock port and must be erased before public output/logging.
- **Read service boundary:** `PublicSearchRequest -> LoadQueryInput -> searchLoads -> internal load results`; `PublicDetailRequest -> LoadDetailInput -> getLoad -> internal load result`. No HTTP field outside the approved DTO reaches the TMS client.
- **Response mapper boundary:** `internal load result -> PublicLoadSummary` or `PublicLoadDetail`; each mapper creates a new allowlisted object. No raw TMS record, parser line, internal pricing, notes, or default/clamping behavior crosses this boundary.
- **Booking boundary:** `PublicBookingRequest -> policy guard (3B denial)`; only a later explicitly mock-scoped 3C port may consume the request. A reserved private mock result maps to the public booking shape without `mc`. No public route may construct a real capability, controlled-booking authorization, ledger, or `LOAD_BOOK` transport request.
- **Error boundary:** typed validation/domain/TMS errors -> one `http-contract.ts` public mapper -> stable status/code/message/retryability and request-ID metadata. `401` is adapter auth only; TMS `AUTH_FAILED` is `502 TMS_AUTH_FAILED`.

Avoid a monolithic route/service/module combining validation, IO, mapping, policy, state, and logging. Constants, parsing, mapping, domain rules, external IO, and logging remain separately testable.

## Data Flow

1. Request enters the existing 3A bounded POST/JSON/correlation/auth pipeline; invalid transport/auth requests terminate before domain/TMS access.
2. The endpoint validator parses an exact allowlist and normalizes approved text/numbers. No body field is copied wholesale into an internal request.
3. Search/detail pass only translated read fields to existing `searchLoads`/`getLoad` and their existing admission/deadline/client/parser/transport seams.
4. Returned records are validated and mapped constructively. Search is sorted by ascending `loadId` and bounded; detail requires the exact requested identity and one fresh record.
5. The shared HTTP contract emits the stable envelope, bounded request ID, safe public data/error, and allowlisted log metadata only.
6. Booking stops after strict validation at the default-deny policy guard in both modes. It performs zero client, port, upstream, mock-state, ledger, or capability calls in 3B.

## Technical Approach

Implement the smallest additive contract layer over 3A. Freeze public names and named bounds first, then extract pure request/response logic from the current `http-dto.ts`/`loads.ts` boundary. Keep the existing read-only service and mature TCP/parser/transport/deadline/limits/resource-control behavior unchanged. Extend centralized error mapping rather than adding route-local maps. Define the future mock contract without wiring it to a public route.

Do not use object spread for public output, silent numeric conversion, silent clamping, fabricated defaults for malformed upstream data, cache/stale fallback, automatic retries, or any capability factory. A requested change that would make real `LOAD_BOOK` reachable is a blocker, not an implementation detail.

## Implementation Steps

1. Freeze public DTO/type/constants, allowlists, named bounds/enums, and domain error taxonomy; retain unversioned paths and 3A envelopes.
2. Extract and strengthen strict request validators and field-by-field response mappers, including normalization, precision, upstream validation, deterministic sorting, and protected-field omission.
3. Wire finalized search semantics to the existing read-only `searchLoads` seam; enforce AND filters, default/max bounds, ascending identity order, and successful empty results.
4. Wire finalized detail semantics to the existing read-only `getLoad` seam; perform one fresh exact-ID read and map unknown IDs safely.
5. Define the private explicitly mock-scoped booking request/result/port contract and centralized errors without enabling the public route, adding a direct `bookLoad` seam, or touching real capability/ledger paths.
6. Add pure DTO/mapper/domain tests, route contract tests, static reachability/leakage checks, and echo regression coverage; retain all existing Phase 1/2 and mock transport tests.
7. Run the full verification plan, review the diff for protected-data/capability exposure, and stop/report any real `LOAD_BOOK` reachability.

Do not implement 3C deterministic mock state, demo success, or fault matrix in this handoff; leave that behavior and its tests for 3C against the seam defined here.

## Test Plan

### Pure contract and mapper tests

- [ ] Search rejects unknown keys, missing filters, date/city/ZIP/cursor/pagination, wrong types, dangerous/framing text, invalid states/equipment, non-positive/over-limit/non-integer `maxResults`; accepts only four names, normalizes values, and defaults to `10`.
- [ ] Detail rejects unknown keys, missing/wrong/overlong/framed `loadId`; accepts only exact `loadId`.
- [ ] Booking rejects `mcNumber`, `maxBuy`, internal ceilings, workflow fields, idempotency, wrong/missing fields, framed/overlong `mc`/`loadId`, non-number/non-finite/non-positive/over-limit/over-precision `agreedRate`; proves `mc` is never included in public output.
- [ ] Response mappers assert exact output keys and absence of notes, `maxBuy`, MC, rawLine, tokens, stacks, and TCP data; cover optional fields, known status enum, safe date/string bounds, numeric bounds, malformed upstream values, duplicate IDs, deterministic sorting, and no silent clamp/default.

### Route/domain/error tests

- [ ] Search success, deterministic order, max bound, AND semantics, and empty `200 loads: []` preserve 3A envelopes/meta.
- [ ] Detail success and unknown exact ID produce one mapped load or `404 LOAD_NOT_FOUND`; no stale/fabricated fallback.
- [ ] Booking remains `403 REAL_BOOKING_DISABLED` in real mode and `403 POLICY_DENIED` in mock mode after valid shape validation; spies prove zero client/port/upstream/state calls and no client override.
- [ ] Typed not-found, conflict, rejected-rate, TMS auth, upstream, protocol, timeout, and validation errors map to stable codes/statuses/messages without raw leakage; distinguish adapter `401` from TMS `502`.
- [ ] Echo remains a regression-only 3A contract test.

### Regression, static, and reachability tests

- [ ] Existing mock dataset/server and TCP fragmented, delayed, malformed, timeout, cleanup, no-retry, and post-write fault tests remain green.
- [ ] Existing parser, transport, deadline, limits, resource-control, policy, controlled-booking, attempt-ledger, and read-only service tests remain green.
- [ ] Static/import checks prove public routes do not import a real capability, controlled-booking port, ledger, real runner, direct mutation seam, or `bookLoad` export. Prove no env/header/query/body bypass and no public DTO internal fields.
- [ ] Do not add or execute real tests; leave the 3C deterministic mock state/demo success/fault matrix as a documented future seam.

## Risks / Safety / Rollback

- **Internal-record mirroring:** current internal types contain `notes` and `maxBuy`, while booking types contain `mcNumber`. Use separate public types, constructive allowlists, and compile/static checks; never expose transitional internal shapes.
- **Malformed upstream data:** weak conversion or silent omission can create unsafe semantics. Validate every approved field with named bounds and fail closed on malformed recognized values using generic protocol/upstream errors.
- **Nondeterministic reads:** provider order or duplicate identities can make HappyRobot behavior unstable. Sort by ascending `loadId`, bound at the domain boundary, and fail safely on duplicate identity.
- **Booking escape hatch:** a generic service or route port could make mutation reachable. Keep 3B booking at the policy guard, test zero calls, and stop if a real capability/direct `bookLoad` seam is proposed.
- **Monolithic implementation:** combining route orchestration, validation, IO, mapping, policy, state, and logging will make leakage and reachability hard to review. Require the modules and pure test seams above.

Safety and rollback rules:

- Keep `ADAPTER_MODE=mock` and `REAL_BOOKING_ENABLED=false`; malformed/unsafe configuration remains fail closed.
- Roll back only 3B contract changes if needed; preserve Phase 3A, Phase 1/2 safety code, tests, and evidence. Do not add a public mutation fallback, retry, unbooking, compensation, plaintext transport, client mode switch, or `rollbackAvailable=true`.
- No real TMS connection, real `LOAD_BOOK`, real runner, production credential, authority, or approval test may be run. Local green tests and mock contracts are not real-provider proof.
- If a proposed change would expose protected data or make real `LOAD_BOOK` reachable, stop and report **BLOCKED** rather than weakening a guard.

## Verification Plan

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Focused DTO, mapper, domain-error, route, leakage, and static reachability tests pass.
- [ ] Existing Phase 1/2 and mock fragmented/delayed/malformed/timeout/cleanup/no-retry regressions pass.
- [ ] Verify no real TMS or `LOAD_BOOK` execution; do not run real TMS scripts or `npm run test:real-tms:booking`.
- [ ] Review changed exports/imports and public JSON for internal fields, MC, notes, raw payloads, duplicated maps, or unsafe configuration exposure.

## Acceptance Criteria

- [ ] Search, detail, and booking request DTOs are exact, strict, normalized, bounded, and contain no invented or workflow-owned fields.
- [ ] Search uses AND semantics, defaults to 10, honors the existing 50 maximum, sorts ascending by `loadId`, and returns successful empty results.
- [ ] Detail performs one fresh exact-ID read and maps unknown loads to `404 LOAD_NOT_FOUND`.
- [ ] Public summary/detail outputs are separate, constructive allowlists with validated safe values and no notes, `maxBuy`, MC, raw records, rawLine, tokens, stacks, or TCP details.
- [ ] `rate` is documented and implemented as public offered rate only; no internal ceiling is public.
- [ ] Booking result/error contracts are defined for 3C, but the 3B public route has no success path, remains `403` in both modes, and performs zero upstream/state/capability access.
- [ ] Error mapping is centralized and stable: validation `400`, not-found `404`, future conflict `409`, future rate rejection `422`, adapter auth `401`, TMS auth `502`, and bounded timeout `504` as specified.
- [ ] No `bookLoad` export, public mutation seam, client-controlled mode/booking switch, real capability import, or real transport path is introduced.
- [ ] Existing TCP/parser/transport/deadline/limits/resource-control/policy/mock/controlled-booking boundaries and Phase 2 regression behavior are preserved.
- [ ] Implementation is modular: routes orchestrate only; validation, constants, mapping, domain errors, read IO, policy, state, and logging remain independently testable.
- [ ] Full verification passes without executing real TMS or real `LOAD_BOOK`.

## Open Questions

These do not block the recommended 3B implementation unless a decision would weaken a safety invariant:

- **Currency and decimal semantics:** What currency/precision does the authoritative TMS use? Default: preserve existing TMS rate units, expose no currency field, accept at most two decimal places, and do not silently round.
- **Public rate policy:** Should `rate` remain public? Default: yes, as the offered rate only; removing it later is a breaking contract decision.
- **API version prefix:** Should paths later move to `/api/v1/tms`? Default: retain unversioned 3A paths; any prefix is a future explicit compatibility decision.
- **Idempotency:** When will an authoritative workflow require an idempotency key? Default: no client idempotency key in 3B; 3C repeat protection remains mock state, not an idempotency guarantee.
- **Mock state lifetime:** Should 3C state be shared across Railway instances? Default: process/test scoped and demo-only until a later deployment decision; do not imply distributed booking authority.
- **Health/deployment:** What health/readiness and Railway policy is required? Default: defer to 3E; 3B performs no health or deployment work.
- **Production authority:** Who owns final real-booking authority, target, egress, evidence, and approval? Default: separate later approval; it cannot be introduced by 3B.

## Handoff to `@coder-heavy`

Implement only Phase 3B from this specification. Preserve 3A and Phase 2, do not commit unless explicitly requested, and do not implement 3C deterministic mock behavior. Stop and report if any change would make real `LOAD_BOOK` reachable, introduce a direct `bookLoad`/real capability seam, weaken default-deny, or expose protected data.
