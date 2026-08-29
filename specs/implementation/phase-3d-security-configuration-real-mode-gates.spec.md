# Phase 3D — Security, Configuration, and Real-Mode Gates Specification

**Status:** **PLAN READY — CURRENT PLANNING/IMPLEMENTATION SLICE; 3D NOT COMPLETE**

## Status and Objective

Phase 3A and 3B are implemented and committed at `8b77734` and `73205d4`. Phase 3C is implemented locally; its commit status is not asserted here. Phase 2 is committed and safety-closed at `048ae3f`. No real TMS operation or real `LOAD_BOOK` has ever been executed.

3D makes runtime mode, server-only secrets, configuration combinations, real-readiness dependencies, public booking guards, and safe observability explicit and fail-closed. It is a security/configuration phase, not production booking enablement. Real booking remains disabled throughout this slice.

HappyRobot owns voice, FMCSA, OTP, negotiation, handoff, extraction, and Twin. The adapter owns HTTP authentication/validation, TCP translation/parsing, normalized errors, mock behavior, real-booking protection, and safe correlation/logging.

## Scope, Non-goals, and Invariants

### Scope

- Central server-only validation for adapter/TMS mode and cross-variable combinations.
- One server-only `ADAPTER_SHARED_SECRET` boundary with fail-closed provisioning and production-strength validation.
- A default-deny public booking guard and explicit real-read-only mode behavior.
- Safe structured logs, bounded correlation, public error mappings, and leakage tests.
- An inventory and regression contract for existing target, TLS/transport, proof/handoff, ledger/fencing, deadline, resource, policy, and evidence controls.

### Explicit non-goals

- Real `LOAD_BOOK`, production provider integration, production approval, or any real side effect.
- OAuth, accounts, payments, dashboard, FMCSA, OTP, voice, Twin, negotiation, or handoff implementation.
- Distributed authority, distributed limiter/storage, independent production target/egress approval, or replacing the existing Phase 2 controls.
- Railway deployment, health/readiness exposure, or runtime shutdown work (3E).
- Broad contract/integration/deployment test expansion (3F) or README rewrite (3G).

### Invariants

- [ ] `ADAPTER_MODE=mock` is the default and the only mode allowed to reach public demo booking.
- [ ] `REAL_BOOKING_ENABLED` is absent or exactly the literal `false`; no 3D enable switch is created.
- [ ] In real mode, public `POST /api/tms/loads/book` returns `403 REAL_BOOKING_DISABLED` before mock state, TMS client, capability, ledger, upstream, socket, or `LOAD_BOOK` access.
- [ ] No body, query, header, request ID, or client-controlled environment value can select mode or enable booking.
- [ ] All `TMS_*`, `ADAPTER_*`, target, authority, and transport inputs are process-start/server-only values consumed through typed configuration; routes never inspect raw environment.
- [ ] Secrets, auth material, raw headers/body, raw frames/lines, MC, full notes, `MAX_BUY`/internal pricing, proofs/nonces, target credentials, stacks, and full errors never enter public responses or logs.
- [ ] Phase 2 target, TLS/transport, proof/handoff, ledger/fencing, deadline, resource, no-retry, evidence, and `rollbackAvailable=false` controls are preserved.
- [ ] No health implementation or real TMS/`LOAD_BOOK` execution is part of 3D.

## Current Repository Evidence and Impact Map

| Current location | Evidence | 3D impact |
| --- | --- | --- |
| `src/tms/adapter-config.ts` | Server-only `AdapterMode`; missing mode defaults to `mock`; non-empty adapter secret is required; mode/TMS combinations and booking flag are checked; `realBookingEnabled` is always `false`. | Preserve the public shape for 3A–3C compatibility, but centralize the cross-variable matrix and production secret-strength decision. Never return raw config errors containing values. |
| `src/tms/http-auth.ts` | Server-only secret retrieval; HMAC comparison with fixed-size digests and `timingSafeEqual`. | Preserve constant-time-safe comparison, one secret, header-only auth, and no query/body auth. Route code must not retrieve raw secrets. |
| `src/tms/config-core.ts` | Owns TMS mode activation, bounded timeout/frame parsing, host/port/auth, target pin/allowlist, authority, and transport checks. | Keep as typed TMS parsing/validation; do not duplicate it in routes or merge it into a monolithic adapter/logging module. |
| `src/tms/http-contract.ts`, `src/tms/request-context.ts` | Central method/content-type/body limits, request IDs, envelopes, safe public messages, and status mapping. | Extend only through shared typed mappings and safe events. Preserve `401` adapter auth, `403` disabled/policy, and `503` configuration semantics. |
| `app/api/tms/**/route.ts` | 3A–3C routes are thin. The booking route validates, loads adapter config, denies real mode, then reaches only the mock port in mock mode. | Keep routes as orchestration only. No raw env, config matrix, logging implementation, TMS client, real capability, ledger, or target authority in routes. |
| `src/tms/client.ts`, `src/tms/logger.ts` | Client logs command/request ID/duration/outcome/error metadata/record count; client preserves write disposition and deadline/resource cleanup. | Replace or constrain log construction to the explicit allowlist. Preserve write-disposition, no-retry, bounded lifecycle, and cleanup behavior. |
| `src/tms/policy.ts`, `src/tms/real/capability.ts`, `src/tms/controlled-booking.ts` | Central command scopes exist; real booking capability creation and `LOAD_BOOK` remain disabled. | Preserve the early real-booking denial and private controlled path. 3D must not create a new capability or generic `bookLoad` seam. |
| `src/tms/target-authority.ts`, `src/tms/transport.ts` | Authority-issued target objects, TLS target validation, and transport boundaries exist. | Real read paths may use only validated targets and approved transport. Missing authority/transport remains a safe configuration failure. |
| `src/tms/real/proof.ts`, `src/tms/real/validators.ts`, `src/tms/attempt-ledger.ts`, `src/tms/deadline.ts`, `src/tms/resource-controls.ts`, and Phase 2 evidence/report boundaries | Proofs are trusted/verified and nonce-bound; ledger tracks one-shot states; deadlines/resources are bounded; evidence must remain sanitized and truthful. | Inventory and regression-test these controls; do not bypass, weaken, or treat in-memory state or Windows directory behavior as production approval. |
| `.env.example` | Documents local TMS settings, `ADAPTER_MODE=mock`, placeholder secret, `REAL_BOOKING_ENABLED=false`, and commented real-runner inputs. | Keep examples secret-free and mock-safe. Real values remain deployment-only and are not copied into specs, tests, logs, or source. |

## Configuration Contract

Configuration is read from a server-only process environment snapshot at startup or through an equivalent immutable first-load cache. A route receives typed configuration or a safe configuration failure; it never reads `process.env`. Unrelated platform environment variables may exist, but no security decision may be sourced from them. Values below are names and policy, not credentials.

| Input | Class | Allowed/required behavior | Safe default or failure |
| --- | --- | --- | --- |
| `ADAPTER_MODE` | Non-secret mode selector | `mock` or `real`; missing means `mock`; preserve current trimming behavior. | `mock`. Any other value: configuration failure. |
| `ADAPTER_SHARED_SECRET` | **Secret** | Non-empty after validation in every environment. In production, recommend at least 32 characters; do not impose that new length on non-production tests unless already required. Never expose, serialize, or log. | No default. Missing/blank: fail closed. Production weak value: configuration failure. |
| `REAL_BOOKING_ENABLED` | Non-secret safety flag | Must be absent or exactly `false` (case- and whitespace-sensitive). `true`, blank, whitespace-padded, malformed, or any other value is invalid. | Absent/`false` means permanently disabled. Never interpret it as an enable switch. |
| `TMS_MODE` | Non-secret TMS mode selector | Absent together with `TMS_ENV`/`TMS_REAL_ENABLED`, or explicit `mock` with both absent, means mock. Real requires the exact real activation triple below. | Mock when no activation fields are present. Contradiction: configuration failure. |
| `TMS_HOST` | Non-secret operational target | Required when TMS config is loaded; positive, bounded target. Mock requires loopback. Real must match the independently approved pin and authority. | No fallback host. Missing/invalid/mismatched: configuration failure. |
| `TMS_PORT` | Non-secret operational target | Required, positive integer, within the existing maximum. | No fallback port. Invalid: configuration failure. |
| `TMS_AUTH_TOKEN` | **Secret** | Required by the existing typed TMS config when a TMS client is created. Server-only; never logs or crosses HTTP/public boundaries. | No default. Missing/blank: configuration failure before connect. |
| `TMS_CONNECT_TIMEOUT_MS` / `TMS_RESPONSE_TIMEOUT_MS` | Non-secret resource controls | Required positive integers within existing upper bounds. | No unbounded fallback. Invalid: configuration failure. |
| `TMS_MAX_FRAME_BYTES` | Non-secret resource control | Optional positive integer; retain existing default and real-mode upper bound. | Existing bounded frame default. Invalid/over-limit: configuration failure. |
| `TMS_ENV` | Non-secret activation context | Real mode requires exactly `non-production`; it must not be used as production approval. | Absent for mock. Partial/incorrect real activation: configuration failure. |
| `TMS_REAL_ENABLED` | Non-secret read-mode activation flag | Real TMS read/validation mode requires exactly `true` with `TMS_MODE=real` and `TMS_ENV=non-production`; it never enables public booking. | Absent for mock. Partial/incorrect activation: configuration failure. |
| `TMS_REAL_TARGET_PIN` | Non-secret but sensitive operational value | Required in real mode and must equal the candidate `host:port`; no arbitrary env host is accepted as pinning. | Absent in mock. Missing/mismatch: configuration failure. |
| `TMS_REAL_TARGET_ALLOWLIST` | Non-secret but sensitive operational value | Required in real mode and must include the exact candidate pin; preserve duplicate/length/format validation. | Absent in mock. Missing/invalid/outside allowlist: configuration failure. |
| `TargetAuthority` / approved manifest | **Server-only authority input**; may contain CA material | Required for real target validation. Only an authority-issued, trusted `ValidatedRealTarget` crosses to transport. It is not a client input or a raw-env substitute. | No authority means no real target and no real connection. |
| `TMS_REAL_TRANSPORT_APPROVED` and TLS/egress policy | Non-secret approval metadata | Preserve existing explicit approved transport/private-network requirement and TLS identity checks. A flag alone is not independent authority. | Missing/unsafe transport: configuration failure before connect. |
| `NODE_ENV` | Non-secret runtime context | Production strength check applies when exactly `production`; it grants no mode or booking authority. | Non-production does not weaken empty-secret or mode/flag checks. |
| `NEXT_PUBLIC_*` | **Forbidden source for adapter/TMS security values** | Never read, mirror, or use for secrets, mode, booking flags, target, auth, or TMS credentials. | No public fallback; missing server-only input fails closed. |

Rotation is deployment-secret replacement followed by process restart/reload. Do not add dual-secret acceptance, key fallback, query authentication, or client-visible secret status in 3D.

## Unsafe-Combination Matrix

All rows fail before mock state, TMS client, capability, ledger, socket, upstream, or booking side effects. `503 CONFIGURATION_UNAVAILABLE` is the safe public mapping for an otherwise authenticated request; missing adapter auth remains `401` because the HTTP authentication boundary cannot be satisfied.

| Unsafe input/combination | Expected safe failure |
| --- | --- |
| Missing or blank `ADAPTER_SHARED_SECRET` | Auth returns `401 ADAPTER_UNAUTHORIZED`; lazy/configured handlers may map the underlying configuration error to `503 CONFIGURATION_UNAVAILABLE`. No dependency is reached. |
| Production adapter secret shorter than the recommended minimum | Typed configuration rejects it; authenticated route returns `503 CONFIGURATION_UNAVAILABLE`. The value and length are not disclosed. |
| Invalid `ADAPTER_MODE` | `503 CONFIGURATION_UNAVAILABLE`; never coerce to mock or real. |
| `ADAPTER_MODE=mock` with non-mock/partial TMS mode | `503 CONFIGURATION_UNAVAILABLE`; never connect to a non-loopback or real target and never silently fall back. |
| `ADAPTER_MODE=real` with non-real or incomplete TMS activation | `503 CONFIGURATION_UNAVAILABLE`; real read is not constructed and public booking remains disabled. |
| `REAL_BOOKING_ENABLED=true` or any value other than absent/exact `false` | `503 CONFIGURATION_UNAVAILABLE`; never treat the value as authorization. |
| Real configuration without target authority, exact pin/allowlist membership, approved egress, or approved TLS/transport | `503 CONFIGURATION_UNAVAILABLE`; no `connect`, `write`, fallback, or target detail in the response/log. |
| Body/query/header/request-ID mode or booking override | Body fields fail strict validation with `400 VALIDATION_ERROR`; query/header values are untrusted and ignored for configuration. Real booking still returns `403 REAL_BOOKING_DISABLED`. Request IDs are correlation only, never auth. |
| Client attempts to alter process environment | Impossible at the adapter boundary; any raw-env read in a route is a static/security failure. The server snapshot is unchanged. |
| `NEXT_PUBLIC_*` used for a secret or security setting | Reject the source by policy/static checks; do not fall back to it. Missing proper server input produces `401`/`503` as applicable. |
| Secret supplied in query/body or emitted in a log | Query secret is not authentication and yields `401` if the auth header is absent/invalid; secret-bearing unknown body keys yield `400`. Logger must omit/redact it; observed emission fails verification. |
| Invalid timeout, frame, port, target, or authority value | `503 CONFIGURATION_UNAVAILABLE` before resource allocation or network access. |

## Files, Modules, and Responsibility Boundaries

| Location | Responsibility | Must not own |
| --- | --- | --- |
| `src/tms/config-policy.ts` (new, recommended) | Pure cross-variable matrix for adapter mode, TMS activation, booking flag, environment, secret presence/strength, and safe failure reasons. | `process.env`, filesystem/network IO, logging, public response construction, or TMS protocol parsing. |
| `src/tms/adapter-config.ts` | Server-only environment snapshot, typed adapter config, secret validation, policy invocation, and compatibility façade for 3A–3C. | Route-local rules, target sockets, logging, mock state, or real capability creation. |
| `src/tms/http-auth.ts` | Private secret-provider boundary, header-only adapter auth, HMAC fixed-size comparison, and `timingSafeEqual`. | Query/body auth, secret logging, mode decisions, or TMS authentication. |
| `src/tms/config-core.ts` | Existing typed TMS parsing, bounded timeouts/frame, target pin/allowlist, authority, and transport validation. | Adapter booking policy, HTTP status mapping, logging, or public DTOs. |
| `src/tms/http-contract.ts` (and a small extracted constants/mapping module if useful) | Shared transport pipeline, stable public status/code/message mapping, request context, and safe error boundary. | Route-specific status maps, raw exception text, or secret/config serialization. |
| `src/tms/request-context.ts` | Bounded request-ID validation/generation and response correlation headers. | Authentication or configuration authority. |
| `src/tms/logger.ts` or new `src/tms/safe-logging.ts` | Positive allowlist, bounded structured event construction, redaction, and sink handoff. | Arbitrary object logging, payload capture, stack capture, or target/secret inspection. |
| `src/tms/client.ts` | Existing TCP/TLS translation, deadlines, resource admission, write disposition, and safe operation outcome logging. | New mode policy, public error mapping, retry, raw-wire logging, or booking enablement. |
| `src/tms/policy.ts` | Existing command-scope policy; preserve real read-only scopes and real `LOAD_BOOK` denial. | Public HTTP auth or a reusable real-booking authorization. |
| `src/tms/real/capability.ts`, `controlled-booking.ts` | Existing private real capability/controlled workflow boundary. | Public route imports, generic `bookLoad`, or a 3D enable path. |
| `src/tms/target-authority.ts`, `transport.ts`, `real/proof.ts`, `real/validators.ts`, `attempt-ledger.ts`, deadline/resource/evidence modules | Existing Phase 2 gates and typed seams. | Bypass, fallback, weakened proof, retry, rollback, or new authority implementation in 3D. |
| `app/api/tms/**/route.ts` | Thin request orchestration and shared handler use. | Raw env, configuration matrix, auth implementation, logging implementation, TMS client/capability/ledger, or business rules. |
| Focused `tests/tms/**` and existing regression tests | Pure matrix/auth/logger/guard tests, route reachability tests, static leakage checks, and Phase 2 regressions. | Real TMS credentials, real sockets, or real `LOAD_BOOK` execution. |

Do not make one configuration module perform parsing, policy, logging, and IO. Extract constants, safe public mappings, mode/booking guards, and log schemas so each boundary remains independently testable.

## Contracts and Interfaces

The following are implementation contracts; names may adjust without changing the boundaries.

```ts
type AdapterMode = "mock" | "real";

interface AdapterRuntimeConfig {
  readonly mode: AdapterMode;
  readonly realBookingEnabled: false;
  readonly nodeEnvironment: string | undefined;
}

interface AdapterSecretProvider {
  /** Server-only; never serializable or callable from a route/client boundary. */
  readForComparison(): string;
}

type ConfigFailureCode =
  | "MISSING_ADAPTER_SECRET"
  | "WEAK_PRODUCTION_SECRET"
  | "INVALID_ADAPTER_MODE"
  | "MODE_MISMATCH"
  | "BOOKING_FLAG_UNSAFE"
  | "TMS_CONFIGURATION_INVALID"
  | "REAL_TARGET_UNAVAILABLE"
  | "REAL_TRANSPORT_UNAPPROVED";

type ConfigValidationOutcome =
  | { readonly ok: true; readonly config: AdapterRuntimeConfig; readonly secretProvider: AdapterSecretProvider }
  | { readonly ok: false; readonly code: ConfigFailureCode };
```

- The raw environment snapshot and failure reason stay server-only. Failure objects contain codes, not values, secrets, target names, or exception text.
- The existing `getAdapterConfig()` façade may retain the current server-only secret property if required for 3A–3C compatibility, but routes/loggers/tests must not serialize or log it. Prefer an opaque provider for new call paths.
- `evaluatePublicBooking(config)` returns only `{ kind: "mock-allowed", mode: "mock" }` or `{ kind: "real-disabled", mode: "real", code: "REAL_BOOKING_DISABLED" }`; it has no real-booking success result.
- `ValidatedRealTarget` can be consumed only after `TargetAuthority` validation. Raw target env, host, port, token, or transport flags never cross into a connector.
- Routes may import shared HTTP helpers, strict DTOs, typed adapter mode/guard, mock-only port in the mock branch, and public mappers. Routes may not import raw-env helpers, `TmsClient`, real capability, controlled booking, attempt ledger, target authority, or direct transport.
- Real read-only runners may consume typed TMS config, existing policy, target, transport, deadline, resource, proof, and evidence seams. The real booking capability remains private and unavailable.
- Public error mappings remain centralized: configuration `503 CONFIGURATION_UNAVAILABLE`, adapter auth `401 ADAPTER_UNAUTHORIZED`, policy/disabled outcomes `403` with stable codes such as `POLICY_DENIED` or `REAL_BOOKING_DISABLED`, validation `400`, and existing safe upstream/timeout mappings. No raw internal message crosses the boundary.

## Runtime Flow

Logical flow:

`process-start/request config load → adapter authentication → bounded request context → strict request pipeline/DTO → mode and policy guard → mock path or existing read-only TMS path`.

The current HTTP implementation may create the bounded request context before authentication solely to return a safe correlation ID on failures. The context has no authority and is not an auth token. Method, content-type, body-size, and auth checks remain before domain/TMS dependencies.

1. Load and validate an immutable server-only configuration snapshot. Invalid configuration produces a safe typed outcome and does not instantiate mock state, clients, ledgers, or sockets.
2. Create or accept only a bounded request ID; generate one when absent/invalid. Authenticate `X-Adapter-API-Key` through the one secret provider and HMAC/timing-safe comparison. Do not parse a booking body before the existing auth boundary.
3. Parse the exact 3A/3B JSON DTO. Unknown mode/booking fields, query values, and client flags cannot alter server configuration.
4. Evaluate the typed mode/booking guard. In mock mode, only the explicitly mock-scoped booking port may be obtained. In real mode, public booking immediately returns `403 REAL_BOOKING_DISABLED`.
5. For public real booking, the termination point is before mock state, `TmsClient`, TMS config/client construction, real capability, controlled workflow, proof, ledger, target, transport, upstream, socket, or `LOAD_BOOK` access.
6. For mock reads/booking, preserve 3A–3C DTOs, deterministic state, public mapping, and shared envelopes. Mock public booking must not call the TMS client.
7. For real mode read/validation operations only, consume typed TMS config and existing `DEBUG_ECHO`/read-only policy, target authority, TLS/transport, deadline, resource, parser, and evidence seams. No public path may obtain a real booking capability.
8. Map errors once through `http-contract.ts`, emit only a safe event, and return the request ID. Configuration details, target values, stack traces, and upstream text remain internal.

## Real-Mode Gate Inventory

| Gate | Local control to preserve/test | Phase 3/external dependency | 3D decision |
| --- | --- | --- | --- |
| Central mode/booking policy | `adapter-config.ts` plus pure cross-variable matrix; real public booking guard. | Separate production approval is not supplied by a flag. | Mock may demo; real booking is always disabled. |
| Capability factory | Private `real/capability.ts` and controlled booking boundary; current real capability remains unavailable. | Named final authority/approver and approved workflow. | Do not create or expose a capability. |
| Controlled workflow | Existing query/selection/detail/handoff/write sequencing and no-retry semantics. | HappyRobot and trusted provider handoffs. | Preserve; no public entry point. |
| Target authority and TLS/transport | Exact pin/allowlist, trusted `ValidatedRealTarget`, TLS identity, approved egress/transport, bounded connector. | Independent target/egress approval and platform network controls. | Missing or unsafe dependency is configuration failure/blocked, never fallback. |
| Proof/handoff | Existing verified claims, freshness, identity binding, nonce/replay protection, and validators. | Trusted OTP, negotiation, carrier/FMCSA providers and evidence. | No self-attested env JSON or caller boolean can authorize real booking. |
| Ledger/fencing | Existing one-shot state and `rollbackAvailable=false`; file durability behavior remains authoritative where used. | Durable multi-worker storage and accepted Windows directory durability semantics. | In-memory/process-local state never becomes real authority. |
| Deadline/resource controls | Existing connect/response/end-to-end deadlines, frame/body/record bounds, rate/concurrency admission, cleanup. | Platform capacity and distributed controls are later concerns. | No unbounded or retrying path is introduced. |
| Evidence/observability | Existing constructive evidence/redaction/report rules plus 3D safe log allowlist. | Approved sink, retention, and independent review. | No raw payload or false-success evidence; logging cannot grant readiness. |

## Safe Logging and Observability Contract

Use a positive allowlist and construct events field-by-field. The conceptual event shape is:

```ts
interface SafeLogEvent {
  readonly requestId: string;                 // bounded validated correlation only
  readonly route: "echo" | "search" | "detail" | "book";
  readonly operation: "adapter-request" | "tms-read" | "mock-booking";
  readonly mode?: "mock" | "real";           // typed mode only, omit when unnecessary
  readonly outcome: "success" | "auth-denied" | "validation-denied" | "policy-denied"
    | "configuration-denied" | "upstream-error" | "timeout" | "resource-denied";
  readonly publicStatus?: number;             // allowlisted HTTP status only
  readonly publicErrorCode?: string;          // allowlisted public code only
  readonly durationMs: number;                // bounded non-negative value
  readonly recordCount?: number;              // bounded non-negative integer
}
```

- `requestId` is logged only after the existing bounded pattern/length validation or after generation. It is correlation, never authentication or authorization.
- `durationMs` and `recordCount` use named central bounds aligned with existing deadline/result limits; invalid or oversized values are omitted or safely bounded, never stringified wholesale.
- Map internal command names to the closed `route`/`operation` values. Do not log arbitrary `request.command`, raw remote text, or full error objects.
- Never log `ADAPTER_SHARED_SECRET`, `TMS_AUTH_TOKEN`, API keys, raw headers, query/body/payload, raw frames/lines, MC, full notes, `MAX_BUY`/internal pricing, proofs/nonces, target credentials, host/port details, or stacks.
- Internal error classification may use a closed type/category, but public-safe status/code is the only error detail emitted. No exception message or stack is a substitute for the allowlist.
- The logger must accept only `SafeLogEvent`; `console.info`/sink calls must not receive arbitrary context objects.
- Recommended sampling: retain 100% of auth/configuration/policy denials and all anomalous leakage/security events; sample routine successful mock/read events at a bounded low rate (recommended 10%) if volume requires it. Do not sample away evidence of a denial.
- Recommended retention: the shortest approved sink retention, initially seven days or the platform minimum if shorter, with no raw payload retention. Exact sink/retention remains an open question.

## Implementation Steps

1. **Config policy matrix:** Extract pure named constants/types and validate adapter mode, TMS activation, booking flag, `NODE_ENV`, secret presence/production strength, and unsafe combinations without logging values or performing IO.
2. **Secret/auth hardening:** Preserve the single server-only secret, HMAC fixed-size comparison, `timingSafeEqual`, header-only auth, and external rotation-by-restart. Add focused tests for missing/blank/weak secrets and no leakage without changing non-production compatibility unnecessarily.
3. **Guard integration:** Route all public booking decisions through the typed guard. Keep mock mode as the only public demo path; make real mode terminate with stable `403 REAL_BOOKING_DISABLED` before every booking dependency. Keep read-only real paths subject to existing TMS/target/transport gates.
4. **Safe logging:** Extract the event allowlist, bounded correlation/duration/count handling, public error code mapping, redaction, and operation mapping. Adapt `client.ts` and HTTP boundaries without changing transport/write-disposition semantics.
5. **Focused tests:** Add config matrix, secret/auth, override, zero-dependency, static import/leakage, logger, and target/TLS/authority regression tests.
6. **Full local verification:** Run the required repository-local typecheck, lint, test, build, and diff checks without any real TMS or `LOAD_BOOK` operation.
7. **Independent security review:** Review the diff/import graph, env sources, public responses, captured logs, and real reachability. Any newly reachable real booking path is a blocker and must be reported, not bypassed.

## Tests and Verification

### Focused 3D tests

- [ ] Configuration matrix covers absent/default, blank/trimmed, invalid mode, mode/TMS mismatch, exact real activation, booking flag true/non-false, invalid timeout/frame/target, missing authority, pin/allowlist mismatch, and unsafe transport.
- [ ] Production secret-strength tests reject missing/blank/weak values without exposing them; non-production short-secret behavior remains backward compatible unless an existing rule already rejects it.
- [ ] Auth tests preserve HMAC fixed-size comparison and `timingSafeEqual`, distinguish missing/invalid adapter auth (`401`) from TMS auth (`502`), and prove no query/body auth.
- [ ] Client override tests prove body/query/header/request-ID values cannot alter mode or booking policy; `NEXT_PUBLIC_*` is not a configuration source.
- [ ] Public booking reachability tests prove mock mode reaches only the deterministic mock port and real mode reaches zero mock state, TMS client, capability, controlled workflow, ledger, target, transport, upstream, socket, and `LOAD_BOOK` dependencies.
- [ ] Static import/export tests prove routes do not import raw env, real capability, controlled booking, attempt ledger, direct transport, or generic/direct booking seams.
- [ ] Logger allowlist/redaction tests assert exact keys, bounded IDs/durations/counts, safe public statuses/codes, and absence of secrets, API keys, tokens, headers, body, MC, notes, pricing, proofs, nonces, frames, lines, targets, stacks, and raw errors.
- [ ] Target authority/TLS/transport tests prove missing/forged/mismatched target validation fails before connect and existing approved-target behavior remains intact.
- [ ] Existing Phase 1/2 parser, transport, deadline, limits, resource, policy, proof, ledger, evidence, no-retry, uncertainty, and cleanup regressions remain green.

### Required repository-local verification

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Confirm no real TMS runner, real credentials, real endpoint, real socket, or real `LOAD_BOOK` was executed. Do not run `LOAD_BOOK` or any real TMS command as verification.

These checks verify the 3D boundary only. Railway/deployment/health checks belong to 3E; broader Phase 3 contract, integration, security, and deployment suite expansion belongs to 3F.

## Acceptance Criteria and Exit Signal

- [ ] Unsafe adapter/TMS combinations fail closed with safe typed errors and stable `503 CONFIGURATION_UNAVAILABLE` mapping where an authenticated request can be evaluated.
- [ ] `ADAPTER_MODE=mock` remains the safe default and the only mode allowed to reach public demo booking.
- [ ] The one server-only `ADAPTER_SHARED_SECRET` is required, never exposed/logged, compared through the preserved HMAC/timing-safe boundary, and has the recommended production-only strength check.
- [ ] No client request field, header, query value, request ID, `NEXT_PUBLIC_*` value, or raw process environment access can alter mode, target, authority, or booking policy.
- [ ] Real read/validation paths remain constrained by TMS mode, target authority/pin/allowlist, TLS/transport, proof/handoff, deadline, resource, and existing Phase 2 controls.
- [ ] Public real booking is unreachable and always returns `403 REAL_BOOKING_DISABLED` before mock state, client, capability, ledger, upstream, or transport access.
- [ ] Safe structured logs implement the explicit allowlist, bounded correlation and measurements, redaction rules, and stable public error categories; no raw payload is logged.
- [ ] Phase 2 controls, no-retry/uncertainty semantics, evidence boundaries, and `rollbackAvailable=false` remain intact.
- [ ] Required local verification passes without real TMS or real `LOAD_BOOK` execution.
- [ ] 3D exits only when unsafe configuration fails closed, the server-only secret/auth boundary is enforced, safe logging is tested, public real booking is unreachable, and real-readiness dependencies are explicit and reviewed.
- [ ] 3D does **not** exit by setting an enable flag, creating a real capability, approving a provider, or executing a real booking.

## Risks, Rollback, Safety, and Dependencies

### Risks and mitigations

- **Configuration drift or split authority:** keep cross-variable policy in one pure matrix; keep TMS parsing, target validation, logging, and IO in separate modules.
- **Secret exposure or weak comparison:** retain server-only retrieval, fixed-size HMAC comparison, `timingSafeEqual`, positive log allowlists, and no dual-secret fallback.
- **Real escape hatch:** make real public booking an early terminal denial; static-test imports and spies; stop/report `BLOCKED` if any change makes `LOAD_BOOK` reachable.
- **3A–3C regression:** preserve existing façade names, DTOs, envelopes, mock state, deterministic outputs, and centralized error mappings; make additive changes only where possible.
- **False readiness from local controls:** file/in-memory ledgers, local authority fixtures, mock results, and green tests are not production authority, distributed durability, or provider evidence.
- **Windows durability or external dependency gaps:** retain local fail-closed behavior and classify missing distributed/authority/platform dependencies as Phase 3/production blockers, never as reasons to relax gates.
- **Observability leakage:** construct only `SafeLogEvent`, reject arbitrary keys, and prefer omission over diagnostic detail.

### Dependencies

- Phase 2 baseline and safety-closed commit `048ae3f`.
- Implemented 3A/3B contracts and locally implemented 3C mock behavior.
- Existing typed TMS, target, transport, policy, proof, deadline, resource, ledger, evidence, and error seams.
- Later external decisions for target/egress approval, trusted providers, distributed durability, secret manager, log sink/retention, deployment, and final real-booking authority. None is a reason to weaken 3D.

### Rollback and safety rules

- Revert only 3D changes if necessary; restore the 3C mock branch and real-mode `REAL_BOOKING_DISABLED` behavior. Do not add a silent fallback to real or mock when configuration is unsafe.
- If logging or config handling is unsafe, disable the affected new path and retain safe denial; never emit raw diagnostics while debugging.
- Rotate secrets externally by replacing the deployment secret and restarting; do not implement dual-secret logic or write secrets to source, tests, reports, or logs.
- Preserve consumed attempts, no-retry behavior, uncertainty classification, evidence provenance, and `rollbackAvailable=false`; do not add unbooking, compensation, simulated rollback, polling, or retry.
- No 3D implementation or verification step may execute a real TMS operation or `LOAD_BOOK`. Stop and report any proposal that would do so.

## Open Questions

These are non-blocking and must not weaken the invariants above:

- **Secret manager and rotation cadence:** exact production provider and schedule are undecided. **Recommend:** deployment-managed server secret with replacement/restart rotation; no dual-secret application logic.
- **Production minimum secret length:** a platform may impose a stronger value than 32 characters. **Recommend:** enforce at least 32 characters in production and adopt the stricter platform/security policy when confirmed.
- **Log sink and retention:** exact provider, access controls, and retention are undecided. **Recommend:** approved server-side sink, shortest retention, initially seven days or platform minimum if shorter, with no payloads.
- **Health/readiness exposure:** public/private shape is undecided. **Recommend:** defer all health/readiness behavior to 3E; do not expose secrets or detailed config from 3D.
- **Final real-booking approver/authority:** owner and evidence authority are undecided. **Recommend:** separate named approval after all gates, with no approval inferred from environment flags or local tests.
- **Future public real-read mode:** whether real read-only behavior should later be exposed publicly is undecided. **Recommend:** keep current public routes mock-safe/deny booking and expose no new real-read route in 3D.

## Handoff to `@coder-heavy`

Implement only Phase 3D. Do not commit unless separately requested. Do not execute commands that contact a real TMS, do not execute `LOAD_BOOK`, and do not add real credentials or targets. Preserve 3A–3C behavior and update only directly relevant source/config/test boundaries during the later implementation. Stop and report immediately if any change makes real booking reachable, introduces a generic/direct booking seam, weakens default-deny/no-retry/`rollbackAvailable=false`, bypasses target/proof/ledger/deadline/evidence controls, or exposes secrets/raw payloads.
