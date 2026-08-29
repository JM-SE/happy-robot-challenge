# Phase 3A — HTTP Integration Contract Specification

## Context

Phase 3A is the current Phase 3 implementation slice. Phase 1 is complete and Phase 2 is committed as `048ae3f` with its safety gates closed. Real TMS traffic and real `LOAD_BOOK` have never been executed. This phase adds a thin HTTP adapter only; it does not authorize, expose, or implement a production real-booking path.

The implementation agent must preserve the mature TCP protocol, parser, transport, deadlines, limits, resource controls, policy, mock, and controlled-workflow boundaries from Phases 1/2. Subsequent Phase 3 work depends on this contract.

## Goal and Scope

Create one public HTTPS JSON contract for:

- `POST /api/tms/echo`
- `POST /api/tms/loads/search`
- `POST /api/tms/loads/detail`
- `POST /api/tms/loads/book`

All four routes require adapter authentication. An optional unauthenticated `GET /api/health` is a later/dependent 3E concern; if implemented later, it must not read, expose, or probe sensitive TMS configuration and its status contract is finalized separately.

Phase 3A owns HTTP authentication/validation, correlation, TCP translation/parsing delegation, normalized responses/errors, deterministic mock boundaries, safe logs, and booking protection. HappyRobot-owned voice, FMCSA, OTP, negotiation, handoff, extraction, and Twin behavior is out of scope. SDK, OAuth/accounts/payments/dashboard, and production real `LOAD_BOOK` are also out of scope.

## Dependencies / Inputs

- [ ] Phase 1/2 implementation and tests remain the baseline; no real TMS or `LOAD_BOOK` run is permitted during this phase.
- [ ] Existing `src/tms/client.ts`, parser, transport, deadline, limits, resource-control, policy, mock, and service seams.
- [ ] Existing Phase 2 default-deny/controlled-booking and `rollbackAvailable=false` safety semantics.
- [ ] The phase index at [`phase-3-index.spec.md`](./phase-3-index.spec.md).
- [ ] No production credentials, hostnames, tokens, MC values, rates, raw frames, or operational identifiers in source, fixtures, logs, examples, or this artifact.

## Evidence-Based Repository Map

| Current location | Observed responsibility | 3A implication |
| --- | --- | --- |
| `app/api/tms/echo/route.ts`, `app/api/tms/loads/search/route.ts`, `app/api/tms/loads/detail/route.ts` | Thin POST handlers parse bodies and call `TmsClient`/`service`; echo has ad hoc request-ID truncation, and routes have no shared adapter auth/meta contract. | Keep orchestration thin and move shared auth, request context, envelopes, method/content-type checks, and status mapping out of individual routes. |
| `app/api/tms/loads/book/route.ts` | Reads a body, checks current caller authorization, then unconditionally denies the public mutation route before TMS access. | Preserve and strengthen default-deny. Validate the 3A shape without wiring a public booking capability. |
| `src/tms/http.ts` | Owns bounded JSON reading and generic error/JSON helpers; current behavior lacks content-type enforcement, shared API-key auth, request-ID response metadata, and a distinct adapter-auth error boundary. | Extend or split into shared HTTP contract modules; do not put TMS IO there. |
| `src/tms/config-core.ts`, `src/tms/config.ts` | Own server-only TMS mode/config, target checks, token, timeouts, and frame settings; there are no `ADAPTER_*` concepts. | Add server-only adapter configuration without `NEXT_PUBLIC_*`, and retain TMS mode/target safety. |
| `src/tms/service.ts` | Read-only `searchLoads` and `getLoad` operations over a TMS port; the direct `bookLoad` service seam was removed in Phase 2. | Reuse read service/ports; do not reintroduce a generic direct booking service. |
| `src/tms/client.ts`, parser, transport, deadline, limits, resource controls | Mature TCP execution, response parsing, cleanup, deadlines, and policy seams; the isolated controlled-booking client/capability is not a public route surface. | Reuse these seams; HTTP must never construct or bypass a real booking capability. |
| `src/tms/loads.ts`, `src/tms/types.ts` | Existing internal query/detail parsers and public/internal load types; internal records include fields such as `MAX_BUY`, and current public mapping includes `notes`. | Define a closed public HTTP DTO allowlist; omit full/raw notes unless a later 3B decision explicitly defines a bounded sanitized field, and never expose internal pricing or raw records. |
| `src/tms/http.ts`, `src/tms/json-limits.ts`, `src/tms/logger.ts` | Bounded JSON structure validation and allowlisted TMS operational logging already exist. | Preserve them and add HTTP-level content-type, auth, request-ID, and public-error guarantees without logging request payloads or secrets. |
| `mock/` | Deterministic local LTMS server/dataset and fragmented, delayed, malformed, timeout, remote-error, and post-write fault scenarios. | Keep mock-local and reusable for later 3C; no mock option may select real transport. |

## Public Contract

### Authentication and transport boundary

- Require `X-Adapter-API-Key` on every TMS route. Header lookup is case-insensitive, but the value is never accepted from query parameters or JSON.
- Read the expected value only from server-only `ADAPTER_SHARED_SECRET`. Never include it in source examples, query/body data, logs, errors, responses, or `NEXT_PUBLIC_*` variables.
- Missing or invalid adapter credentials return the same stable adapter error and HTTP `401`; do not reveal which condition occurred. Compare secrets in a length-safe constant-time manner where practical (for example, equal-length byte comparison); never use the request ID for authentication.
- An upstream TMS `AUTH_FAILED` is not adapter authentication. Once adapter auth succeeds, map a TMS authorization failure to a non-401 upstream error such as `502 TMS_AUTH_FAILED`, so caller auth and TMS auth cannot masquerade as each other.
- Enforce POST and JSON content type for the four TMS routes. Accept `application/json` with parameters such as charset; reject unsupported or missing media types with `415`. Unsupported methods return `405` and `Allow: POST` where the runtime permits explicit handling.
- Read bodies with the existing bounded streaming reader and structural JSON limits. Reject malformed UTF-8/JSON, oversized bodies, excessive depth/keys/arrays/strings/numbers, dangerous prototype keys, and non-object endpoint bodies without reflecting input.
- Public HTTPS/TLS termination is a deployment concern for 3E; local tests may use `Request` objects and the existing mock transport but must not weaken the public contract.

### Envelopes and correlation

Success shape:

```json
{"ok":true,"data":{},"meta":{"requestId":"..."}}
```

Error shape:

```json
{"ok":false,"error":{"code":"PUBLIC_ERROR_CODE","message":"Stable public message.","retryable":false},"meta":{"requestId":"..."}}
```

The error shape may omit `retryable` only if the shared contract makes that decision consistently; it must never include raw exception text, stacks, TCP lines/frames, tokens, internal pricing, `MAX_BUY`, MC values, or full/raw/sensitive notes. `meta` contains only bounded allowlisted metadata.

- Accept a safe bounded `X-Request-ID` or generate a UUID when absent.
- Recommended validation: 1–64 characters, ASCII `[A-Za-z0-9._:-]`, reject invalid/overlong values rather than silently truncating. UUID generation is server-side.
- Return the accepted/generated ID in the `X-Request-ID` response header and `meta.requestId` on both success and error responses.
- Log only sanitized structured metadata such as route/operation, request ID, duration, outcome, public error code, and bounded record count. Never trust the ID for auth, and never log body fields, API keys, TMS tokens, raw wire, or full exception messages.

### Recommended status and public error mapping

| Status | Stable public codes | Meaning |
| --- | --- | --- |
| `200` | — | Successful normalized response. |
| `400` | `MALFORMED_JSON`, `VALIDATION_ERROR` | Invalid JSON or request shape. |
| `401` | `ADAPTER_UNAUTHORIZED` | Missing/invalid `X-Adapter-API-Key`; only adapter auth uses this status. |
| `403` | `POLICY_DENIED`, `REAL_BOOKING_DISABLED` | Caller/policy cannot perform the operation; public booking remains denied. |
| `404` | `LOAD_NOT_FOUND` | Requested load is unknown. |
| `405` | `METHOD_NOT_ALLOWED` | Method is not supported; include `Allow` when applicable. |
| `409` | `BOOKING_CONFLICT` | Booking conflict/already booked, only when a later approved mock/domain contract supplies that behavior. |
| `413` | `REQUEST_TOO_LARGE` | Body or JSON limit exceeded. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Request is not supported JSON. |
| `422` | `SEMANTIC_VALIDATION_ERROR` | Shape is JSON but domain semantics are invalid, if 3B uses this distinction. |
| `502` | `UPSTREAM_ERROR`, `TMS_AUTH_FAILED`, `PROTOCOL_ERROR` | TMS/transport/protocol failure after adapter auth. Never expose raw upstream diagnostics. |
| `503` | `CONFIGURATION_UNAVAILABLE`, `REAL_MODE_UNAVAILABLE`, `SERVICE_UNAVAILABLE` | Server configuration, real-mode setup, or permitted service is unavailable. |
| `504` | `TMS_TIMEOUT` | Bounded TMS deadline expired. |

The implementation must centralize status/code/message mapping. It must not copy arbitrary `TmsAdapterError.message` into a public response. Existing remote codes may be normalized to an allowlisted public code; unknown remote codes collapse to a stable upstream error rather than exposing remote text.

## Endpoint Contract Table

Detailed domain DTOs are finalized in 3B. The following is the fixed 3A boundary and must not invent fields.

| Endpoint | Request JSON | Success data | 3A behavior and constraints |
| --- | --- | --- | --- |
| `POST /api/tms/echo` | `{ "message": string }` only. | Current normalized echo semantics, e.g. `{ "message": string, "fieldCount": number }`. | Preserve current message validation/framing limits. No auth token or raw response fields; include request ID meta. |
| `POST /api/tms/loads/search` | Public names are exactly `originState`, `destinationState`, `equipmentType`, `maxResults`; no invented date field. | `{ "loads": PublicLoadSummary[] }`. | Validate an allowlisted object, normalize state/equipment/max-results through existing pure rules, and map only public load summaries. Any additional public search fields require a later explicit 3B decision. |
| `POST /api/tms/loads/detail` | `{ "loadId": string }` only. | `{ "load": PublicLoad }`. | Validate bounded `loadId`, call existing read-only detail service/port, map `UNKNOWN_LOAD` to `404 LOAD_NOT_FOUND`, and exclude internal/raw fields. |
| `POST /api/tms/loads/book` | `{ "loadId": string, "mc": string, "agreedRate": number }` only. | Reserved for the later 3B mock-booking contract; no 3A success mutation. | Validate shape and bounded values, then deny public mutation before any upstream request/state change. In real mode return stable `403 REAL_BOOKING_DISABLED`. No client switch can enable real mode. In mock mode 3A remains denied until 3C/3B explicitly supplies a labeled mock behavior. |
| `GET /api/health` *(optional/later)* | No JSON body. | Minimal liveness object to be finalized in 3E. | If added, do not require TMS credentials, return secrets/config, or perform TMS IO. Health exposure/auth/readiness policy is not a 3A blocker. |

The public `mc` field may be mapped to the existing internal `mcNumber` only at a deliberate DTO boundary if a later mock/domain phase needs it; do not expose `mcNumber` as an alternate public spelling in 3A.

## Module Boundaries / Contracts

Names are recommendations; an implementation agent may adjust paths while preserving these responsibilities.

- `src/tms/http-contract.ts` or equivalent — named header/status/body-limit constants, method/content-type checks, success/error envelopes, public error mapping, `Allow` handling, and response headers. No TMS IO.
- `src/tms/http-auth.ts` or equivalent — server-only shared-secret retrieval and adapter-key verification with safe constant-time comparison. No domain rules or TMS calls.
- `src/tms/request-context.ts` or equivalent — request-ID validation/generation, bounded context, response propagation, and sanitized log context. Request IDs are correlation only.
- Route-local request schemas/DTO validators, with genuinely common pure helpers extracted — endpoint shape, allowlisted keys, normalization, and public-to-internal mapping. No credentials or route-embedded business policy.
- `app/api/tms/{echo,loads/search,loads/detail,loads/book}/route.ts` — thin orchestration only: method/content type/size → auth/context → parse/validate → domain/service/port → normalized response. No duplicated status mapping, raw TMS parsing, config policy, or booking capability.
- `src/tms/config-core.ts` / `src/tms/config.ts` — extend server-only configuration for adapter mode/shared secret/booking flag while retaining existing TMS target, mode, timeout, frame, and loopback/real safety checks.
- `src/tms/logger.ts` or a pure safe logging helper — allowlisted metadata only; no request body, secret, raw line/frame, or internal pricing.
- `src/tms/service.ts`, `src/tms/client.ts`, parser, transport, deadline, limits, resource controls, and `mock/` — retain existing boundaries and use them through ports. Do not route public Phase 3A booking to the isolated controlled-booking seam.
- `src/tms/policy.ts`/capability boundary — retain default-deny and ensure real `LOAD_BOOK` remains blocked. No public factory, boolean, cast, header, or env value may mint real authority.

Centralize header names, request-ID bounds, body/JSON limits, endpoint names, public error codes/statuses, and mode/booking constants. Do not create a monolithic route/module combining parsing, auth, config, IO, domain mapping, policy, and logging.

## Technical Approach

Implement the shared pipeline once and have each route provide only its endpoint validator and domain call:

1. Establish bounded request context and method/content-type/declared-size checks.
2. Authenticate against server-only `ADAPTER_SHARED_SECRET`; fail before TMS access on missing/invalid credentials.
3. Read and structurally validate bounded JSON, then apply the endpoint DTO validator.
4. Call `searchLoads`/`getLoad` or an existing echo/client port. Booking stops at the public policy guard in 3A.
5. Map only closed public DTOs and stable public errors, set `X-Request-ID`, envelope metadata, and safe structured logs.

The adapter must preserve existing fragmented/delayed response handling, timeout cleanup, rate/concurrency admission, no-retry behavior, and raw-wire privacy. HTTP cancellation/timeout handling must not leave TMS sockets, timers, listeners, permits, or mock resources behind.

## Configuration Contract

Existing TMS configuration remains server-only and continues to include:

- `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN`
- bounded `TMS_CONNECT_TIMEOUT_MS`, `TMS_RESPONSE_TIMEOUT_MS`, and `TMS_MAX_FRAME_BYTES`
- existing TMS mode/target/transport authority settings where required by Phase 2

Add the following server-only adapter settings:

- `ADAPTER_MODE=mock` — explicit recommended/default local and deployed demo mode. A distinct real read-only runner/config may be supported later, but it is not a booking capability.
- `ADAPTER_SHARED_SECRET` — required to serve the four public TMS routes; never logged or returned.
- `REAL_BOOKING_ENABLED=false` — explicit recommended/default. In 3A, `true`, malformed, or conflicting values must fail closed; no request can override it. A later 3D/production approval may add further independent gates, but this spec does not make `true` sufficient.

Distinguish mock/local runtime from any real runner by configuration and process/capability boundary. Mock mode must remain loopback/mock-only as already required. Real read-only mode, if selected, must still return `REAL_BOOKING_DISABLED` for booking. Reject unsafe combinations such as mock mode with a non-loopback/mock target, missing adapter secret for public routes, ambiguous boolean values, or real/booking flags without all later authority gates. Never use `NEXT_PUBLIC_*` for these values and never log their values.

## Security and Behavior Rules

- [ ] Adapter auth is checked independently from TMS auth; remote `AUTH_FAILED` never becomes a caller `401`.
- [ ] No secret leakage in query/body/log/error/response/example; no raw line/frame, stack, token, `MAX_BUY`, internal pricing, MC, or full/raw/sensitive notes in public data.
- [ ] Request IDs are bounded correlation data only and cannot authorize, select mode, or influence booking policy.
- [ ] Real mode cannot be overridden by request/header/body/client env input. `REAL_BOOKING_ENABLED` is not a client feature flag.
- [ ] Public booking is default-deny, makes no upstream request in 3A, is not retried, and returns stable `REAL_BOOKING_DISABLED` in real mode.
- [ ] Later real-booking work must preserve one-shot/write-disposition evidence and `rollbackAvailable=false`; 3A does not manufacture booking evidence.
- [ ] Existing deadlines, rate/concurrency controls, parser framing, cleanup, and transport policy remain authoritative.
- [ ] Public DTOs are closed and allowlisted; `MAX_BUY`, full/raw notes, and internal pricing remain private even if present in mock/TMS records.

## Test Plan

Add focused tests at independently testable seams; keep existing Phase 1/2 tests and real-runner exclusion intact.

### HTTP contract/auth/context seams

- Missing, wrong, and correct `X-Adapter-API-Key`; server secret absent/malformed; adapter auth errors are stable `401`; constant-time-safe comparison behavior is tested as feasible without timing assertions that are flaky.
- Accepted safe request ID, generated UUID, invalid character/length rejection, response header/meta propagation on success and error, and checks that request IDs never authorize.
- Missing/unsupported content type, unsupported method with `Allow`, malformed JSON, invalid UTF-8, streamed oversized body, structural depth/key/array/string/number limits, dangerous keys, and non-object bodies.
- Success envelope, error envelope, request-ID metadata, stable statuses/codes/messages, remote `AUTH_FAILED` distinction, unknown remote-code normalization, and absence of raw messages/stacks.

### Endpoint/domain seams

- Echo message normalization/framing and normalized response.
- Search accepts exactly `originState`, `destinationState`, `equipmentType`, and `maxResults` at the 3A public boundary; rejects invented date/unknown fields and normalizes values before the existing service/port.
- Detail accepts exact `loadId`, returns a public load only, maps unknown load safely, and does not expose raw/internal fields.
- Booking validates exact `loadId`/`mc`/`agreedRate` shape, returns `REAL_BOOKING_DISABLED` in real mode, remains denied in 3A mock mode, makes no upstream request/state mutation, and never retries.

### Leakage and reachability seams

- Responses/logs do not contain adapter/TMS secrets, raw TCP lines/frames, stacks, `MAX_BUY`, internal pricing, full/raw/sensitive notes, MC values, or request bodies.
- Static/import checks prove public routes do not import or construct a real booking capability/direct booking port and that no `confirmed`/header/env client bypass exists.
- Booking-disabled tests assert the mock server has zero request/dispatch activity and no state mutation.

### Regression and mock seams

- Preserve existing mock fragmented, delayed, malformed, remote-error, post-write-no-response, timeout, cleanup, and no-retry coverage.
- Preserve client/parser/transport/deadline/limits/resource-control and read-only service behavior.
- If health is implemented in a later dependency, test its method, body, sensitive-config absence, and readiness policy separately.

Recommended focused command after test files exist (adjust paths, not intent):

```text
npx vitest run tests/tms/http-contract.test.ts tests/tms/http-auth.test.ts tests/tms/request-context.test.ts tests/tms/routes.contract.test.ts
```

## Implementation Steps

1. Inventory current route imports/exports and preserve the Phase 2 default-deny booking boundary; add no real runner.
2. Centralize header names, public status/code/message maps, body/JSON/request-ID limits, envelopes, and safe response headers.
3. Implement server-only adapter auth and request context with length-safe constant-time comparison and no secret logging.
4. Extend bounded JSON/method/content-type handling; ensure all four routes use the shared boundary before service/TMS access.
5. Add route-local exact DTO validators and public mappings for echo, search, detail, and booking; map public `mc` deliberately if needed, never expose internal fields.
6. Wire search/detail/echo through existing service/client/mock ports without changing mature TCP/parser/transport policy. Keep route logic orchestration-only.
7. Make booking validation terminate at the explicit Phase 3A policy guard; return stable `REAL_BOOKING_DISABLED` for real mode and no upstream request in every 3A mode.
8. Add contract, leakage, static reachability, mock-fault, and cleanup tests; then run the full verification plan.
9. Report any requested change that would make real `LOAD_BOOK` reachable as a blocker and stop rather than weakening the guard.

## Verification Plan

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Focused HTTP contract/auth/context tests and static import/reachability checks pass.
- [ ] Existing mock fragmented/delayed/timeout/cleanup/no-retry and Phase 1/2 regression tests pass.
- [ ] Verify no real TMS connection and no `LOAD_BOOK` execution; do not run `npm run test:real-tms:booking` or any real runner.
- [ ] Review the diff for secrets, raw payloads, internal pricing/notes, public booking capability imports, duplicated status maps, and unsafe env exposure.

## Rollback / Safety Notes

- Keep `ADAPTER_MODE=mock` and `REAL_BOOKING_ENABLED=false` as the rollback-safe defaults.
- Revert only the 3A HTTP adapter changes if needed; preserve Phase 1/2 code, safety specs, tests, and historical evidence.
- Rollback must not add a public mutation fallback, plaintext transport, retry, capability factory, or client-controlled mode switch.
- If auth/config/contract integration is incomplete, return to explicit mock-safe read behavior or default-deny booking; do not make real mode appear ready.
- No real booking, evidence claim, attempt reset, unbooking, or `rollbackAvailable=true` change is valid in this phase.

## Acceptance Criteria

- [ ] Four requested TMS POST routes share one authenticated, JSON-only, bounded, correlated HTTP contract.
- [ ] `X-Adapter-API-Key` is checked against server-only `ADAPTER_SHARED_SECRET` with stable adapter `401` errors and no secret leakage; TMS auth failures remain distinct.
- [ ] Success and error envelopes are stable, include request ID metadata/header, and expose only allowlisted public data/errors.
- [ ] Methods, content types, malformed/oversized/structurally invalid JSON, exact DTO shapes, and status mappings are tested and safe.
- [ ] Search uses exactly the specified public names and no invented date field; detail uses exact `loadId`; booking uses exact `loadId`/`mc`/`agreedRate`.
- [ ] Echo/search/detail reuse existing mature service/client/parser/transport/deadline/limits/resource/mock boundaries without a rewrite.
- [ ] Phase 3A booking validates shape but cannot mutate or reach upstream; real mode returns stable `REAL_BOOKING_DISABLED`; no client input enables it.
- [ ] No public response/log/test exposes secrets, raw TCP/errors/stacks, `MAX_BUY`, internal pricing, MC, or full/raw/sensitive notes.
- [ ] Configuration is server-only, defaults to mock and booking-disabled, distinguishes mock from real-read-only runtime, and rejects unsafe combinations.
- [ ] Full verification and focused contract/security checks pass without real TMS or real `LOAD_BOOK` execution.
- [ ] No avoidable monolithic HTTP module is introduced; auth, context, validation, mapping, policy, IO, constants, and logging remain independently testable.

## Handoff to `@coder-heavy`

Implement only Phase 3A. Keep changes modular, preserve the existing Phase 1/2 boundaries, and do not commit unless explicitly requested. If any proposed change would make real `LOAD_BOOK` reachable, weaken default-deny, expose a secret/raw payload, or require production credentials, stop and report the blocker instead of proceeding. Subsequent Phase 3 phases depend on this HTTP contract; do not implement their unapproved domain, deployment, or real-booking scope in this handoff.

## Open Questions

Non-blocking defaults are recommended so mock-safe work can proceed:

- Confirm the final HappyRobot header rotation/provisioning process; default: `X-Adapter-API-Key` plus server-only `ADAPTER_SHARED_SECRET`.
- Confirm whether an API version prefix is required; default: keep the requested unversioned `/api/tms/...` routes for 3A.
- Confirm whether health is public or platform-network-only; default: defer to 3E and expose only minimal liveness.
- Confirm Railway domain, observability sink, and retention; default: allowlisted metadata only with no payload/secret retention.
- Confirm the eventual real-booking authority/approval owner; this cannot unblock 3A and must remain a later production decision.
