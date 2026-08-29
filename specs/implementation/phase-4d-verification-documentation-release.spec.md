# Phase 4D — Verification, Documentation, and Release Specification

**Status:** **PLAN READY — CLOSURE SLICE; IMPLEMENTATION NOT ASSERTED**

## Context

Phase 4D closes the Phase 4 delivery after the 4A foundation, 4B APIs/auth, and 4C UI stages have each passed their automatic technical gate and produced an observed phase commit/hash in this run. The five specs were fixed earlier in one planning/spec commit; that commit is the clean baseline prerequisite and is not a phase or inter-phase implementation commit. Phase 4D is the final stage of the one autonomous `@coder-heavy` execution. It is limited to hardening, tests, documentation, and release verification. It must not add product features, alter the Phase 3 TCP/TMS contracts, or execute real booking.

The local projection store is an explicitly temporary result of unavailable Twin provisioning. It is an in-memory, process-scoped, non-persistent adapter fallback and is not native Twin, a durable operational system, or a production replacement. `OperationsMode` is exactly `demo | real-read-only`; **Demo/Mock** is only the UI label for `demo`, `adapter-fallback` is only envelope `meta.source`, and `source` is only record provenance `fixture | ingested`. HappyRobot continues to own AI Extract, Twin, voice, FMCSA, OTP, negotiation, and handoff; the adapter only consumes the approved raw handoff ingestion boundary and maps it to canonical `CallRecord` data.

## Scope, Non-goals, and Invariants

### Scope

- Verify 4A–4C behavior at API, auth, data, UI-state, security, and release boundaries.
- Harden validation, masking, truncation/sanitization, constructive response mapping, and leakage assertions without widening contracts.
- Verify deterministic fixture behavior, fixture-plus-ingestion behavior, fallback-store behavior, dashboard calculations/filters, and documented unavailable states.
- Update `README.md` only to describe tested final behavior, routes, operations auth, configuration, integration mapping, limitations, and safe demo/read-only boundaries.
- Produce a release handoff record containing files, test/build results, limitations, the planning/spec baseline hash, and the four distinct phase hashes, including the final 4D source/release hash.

### Explicit non-goals

- No new feature, route alias, UI workflow, booking control, operational mutation control, persistence layer, Twin replacement, or UI/library/test-framework dependency.
- No change to Phase 3 HTTP/TCP/TMS contracts, parser, transport, real-read-only gates, mock booking contract, or `LOAD_BOOK` semantics.
- No real TMS connection, real `LOAD_BOOK`, real provider smoke test, real credentials, or production activation.
- No claim that native Twin is available or that a mock/demo result is provider evidence.

### Invariants

- [ ] In 4B, `ADAPTER_UI_DATA_MODE=fixture` seeds deterministic fixtures and accepts subsequent sanitized ingestion; unset/empty may start empty and invalid values fail closed. Fixture values do not contain secrets or production identifiers.
- [ ] Ingestion authenticates with the existing adapter header boundary, `X-Adapter-API-Key`, and the server-only adapter secret. It does not accept a UI cookie as adapter authorization.
- [ ] Dashboard API and page authentication use the separate Phase 4 UI secret/session-cookie boundary. The UI cookie does not authorize ingestion/TMS routes, and the adapter secret is never sent to or bundled in the browser.
- [ ] Public responses and browser-visible data omit raw transcript, raw TCP/frame/line data, secrets, internal pricing, `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, full MC/`mcNumber`, raw request/response bodies, tool calls, and original/full/raw notes. List responses contain neither `notes` nor `handoffReason`; detail responses may contain only canonical `mcMasked`, sanitized/canonicalized detail `notes` of `<=240` characters, and a safe bounded detail-only `handoffReason`.
- [ ] Valid demo booking success requires the complete canonical tuple and is explicitly labeled Demo/Mock; real booking remains visibly disabled and unreachable.
- [ ] OTP delivery remains visibly unavailable; Twin remains visibly unavailable with the explicit Twin quota fallback explanation.
- [ ] No booking or operational mutation controls are rendered or exposed through the dashboard.
- [ ] Existing Phase 3 tests remain green, and no verification step runs a real TMS command or `LOAD_BOOK`.

## Dependencies / Inputs

- [ ] Phase 4A foundation handoff and implementation, including fallback-store rationale and data boundaries, with automatic gate PASS and observed 4A phase commit/hash.
- [ ] Phase 4B API/auth handoff, including the canonical ingestion route, payload schema, adapter-header auth, UI-secret/session-cookie contract, and public response allowlists, with automatic gate PASS and observed 4B phase commit/hash.
- [ ] Phase 4C UI handoff, including canonical page/API routes, summary formulas, filter semantics, visible state copy, demo-booking predicate, banners, and responsive/keyboard expectations, with automatic gate PASS and observed 4C phase commit/hash.
- [ ] The single planning/spec commit containing all five Phase 4 specs is identified separately as the pre-run baseline and is not counted among the phase commits.
- [ ] Phase 3 public contracts, adapter auth, mock/demo booking, real-read-only behavior, response envelopes, and leakage protections.
- [ ] Existing package scripts: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Current Next 16 / React 19 package baseline. Do not downgrade, replace, or add a UI/test framework for this phase.

## Files / Modules and Responsibility Boundaries

| Location | Responsibility and boundary |
| --- | --- |
| `README.md` | Final, tested Operations/integration documentation. No secrets, IDs, raw payloads, unsupported routes, or native-Twin claim. |
| `tests/operations/**` | Focused foundation/API/UI/release tests and leakage/security assertions; separate pure, route/auth, and UI-state seams. Hardening may add or modify test files under this scope when necessary. |
| Already-approved 4A–4C files | Only a narrowly scoped correction proven by a failed 4D test; never a new module or contract. |
| Handoff/review record | Report tested files, commands, manual QA, limitations, changed-file inventory, security review, and actual hash; do not add an unrequested report artifact to the repository. |

The exact 4D allowlist is `README.md`, `tests/operations/**`, and focused edits to already-approved 4A–4C files only when required to correct a demonstrated defect. Hardening may add or modify test files under `tests/operations/**` when necessary; no new product module, route, in-repository report, generated artifact, or file outside this allowlist is allowed.

Do not combine request validation, auth, store access, data transformation, calculation, rendering, and side effects in one module. Reuse the 4A–4C seams and extract only small pure helpers where a failing test demonstrates a boundary defect.

## Requirements

### API and data hardening

- [ ] Call/ingestion validation is strict and constructive: correct method/content type/body limit, malformed JSON, exact handoff raw fields, bounded values, silent unknown/forbidden-field drop, safe text/framing rejection, and stable safe errors. Authentication remains before the protected operation according to the 4B contract.
- [ ] MC masking is deterministic and never reveals the source value. Tests include empty, one-character, short, threshold-length, and normal-length values; short values must not be passed through because a suffix would reveal the entire MC.
- [ ] Notes are bounded by `MAX_NOTE_LENGTH=240`, sanitized/canonicalized for HTML/script, control, framing, and unsafe line content before any permitted internal/UI-derived use, and omitted when unsafe. List responses contain no `notes`; detail responses may show only the resulting safe text. The original/full/raw note is never persisted, logged, or returned. `handoffReason` follows the same safe-detail-only boundary: it may appear only as bounded sanitized detail text, never in list or raw form.
- [ ] `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal ceilings, secrets, unknown/forbidden keys, raw transcript, raw TCP/frame/line data, request/response bodies, tool calls, and internal errors are silently dropped/omitted before public response, browser state, or logs, without reflecting key/value; malformed approved values still return a safe error.
- [ ] Public mappers remain constructive allowlists. No object spreading of internal records, fallback records, request payloads, or upstream/TCP objects is introduced.
- [ ] API leakage tests recursively inspect success and error envelopes, headers where applicable, serialized browser data, and captured logs for raw transcript/TCP, secrets, internal pricing, full MC, original/full/raw or unsafe notes, stack traces, and unknown/internal fields. They explicitly assert that list has neither `notes` nor `handoffReason`, while detail may contain only sanitized/canonicalized `notes` `<=240` and a safe bounded `handoffReason`; no original/full/raw value is permitted.

### Authentication and authorization

- [ ] Ingestion accepts only the existing adapter authentication header (`X-Adapter-API-Key`) backed by the server-only adapter secret; missing, malformed, wrong, query, body, or UI-cookie credentials fail safely.
- [ ] Dashboard API requests require the separate UI session cookie/secret defined by 4B. API failures use the established unauthenticated response; dashboard page failures use the established login/redirect behavior.
- [ ] The dashboard page and dashboard API enforce the same UI authorization boundary without treating the page render as API authorization or exposing either secret to client code.
- [ ] Adapter auth and UI auth cannot be substituted for one another, and no request-controlled mode, data-source, booking, or mutation flag bypasses either boundary.

### Dashboard and fallback behavior

- [ ] Summary calculations use only canonical sanitized records and the exact formulas: `fmcsaverified` counts `fmcsaStatus=VERIFIED`; denominator is `VERIFIED + UNAVAILABLE + FAILED` excluding `NOT_RUN`; `fmcsaVerificationRate` is the ratio/null; `loadsMatched` counts calls with any match; demo bookings use the complete tuple; failed negotiations are exact `FAILED_NEGOTIATION`; handoffs are the outcome/status OR rule counted once; technical errors are non-success technical status OR `TECHNICAL_ERROR`. They never derive from `MAX_BUY`, internal pricing, raw notes, raw transcript, or TCP data.
- [ ] Filters use the exact 4C allowlist and semantics, are deterministic, compose as specified, and do not leak hidden fields through counts, empty results, query parameters, URLs, or error messages.
- [ ] Fixture mode is deterministic across reloads, fresh stores, and repeated test runs. `ADAPTER_UI_DATA_MODE=fixture` is the documented safe demonstration setting.
- [ ] Fixture-plus-ingestion coverage proves that an authenticated handoff-shaped raw ingestion is accepted by the canonical route, is sanitized into one `CallRecord`, updates the temporary fallback view, and is reflected by the dashboard. A repeated `callId`, including identical replay, returns `409 DUPLICATE_CALL_ID` and is not duplicated; invalid/unauthorized ingestion does not alter visible state.
- [ ] The fallback store is explicitly process-local, in-memory, and non-persistent. Restart and Railway multi-instance behavior is documented as a limitation; no consistency, durability, or distributed authority is implied.
- [ ] Empty, loading, and error states are distinct, stable, accessible, and safe. They do not expose raw exceptions, response bodies, credentials, or transport diagnostics.
- [ ] Demo-booking success is shown only when `bookingSuccessful === true`, a valid `bookingReference` exists, `outcome === "SUCCESS"`, `mode === "demo"`, and canonical `bookingStatus === "BOOKED"`; it is labeled Demo/Mock. A `200` read/ingestion response, partial tuple, isolated reference, attempt, or real-read-only result must not be rendered as booking success.
- [ ] Real booking remains disabled in both API behavior and UI copy. No `LOAD_BOOK` control, submit action, retry action, mutation endpoint, hidden button, or keyboard-accessible mutation control exists.
- [ ] OTP-unavailable, Twin-unavailable/quota-fallback, and real `LOAD_BOOK` disabled banners remain the three mandatory limitation banners, use accurate non-authorizing language, and do not claim operational completion.
- [ ] `IntegrationHealth` uses only the centralized static capability/limitation items passed through server-safe props/config: Twin unavailable/quota fallback, OTP delivery unavailable, loadboard/TMS read status only when an existing safe signal is supplied, and real `LOAD_BOOK` disabled (with FMCSA recorded-status information only when safely signalled). No health endpoint, live check, inferred `healthy`/`real` state, or TMS call is added; absent signals show `Unavailable`/`Not configured`.

## Technical Approach

Use a verification-first pass over the 4A–4C boundaries: pure validators/mappers/maskers → authenticated route contracts → local-projection/data-source integration → calculation/filter helpers → dashboard state/presentation → documentation → full release gate. Prefer existing Vitest tests and current application seams. Do not add a test framework, browser library, state library, or UI component library unnecessarily.

The final API review is deny-by-default: construct a safe response from the approved public fields, then recursively scan serialized output and captured logs with synthetic sentinel values for every prohibited category. The final UI review checks both rendered text and network/client payloads; CSS-hidden or unreachable controls still count as a failure if they expose mutation behavior.

The README is written from observed routes and passing tests, not from intended behavior. Route names, field names, auth status behavior, summary formulas, and banner copy must come from the 4A–4C contracts. Do not invent aliases to make documentation appear complete.

## Required Test Matrix

| Area | Required coverage and evidence |
| --- | --- |
| Call validation | Exact handoff raw schema (`callId` optional; `occurredAt`, `mcNumber`, `fmcsaverified`, `otpVerified`, `bookingSuccessful`, `bookingRef`, `outcome`, `handoffReason`, `notes`, `mode`, `technicalStatus`; `loadId?: string | null` and `agreedRate?: number | null`; plus only the four safe enrichment scalars), types, bounds, silent unknown/forbidden drop, malformed JSON, method/content type, body limit, dangerous/framed text, and safe error mapping. Assert omission and explicit `null` are equivalent for no match/no agreed rate, never invent data, and invalid approved values do not reach store or dashboard state. |
| MC masking | Empty, one-character, short, boundary, and normal values. Assert the raw value and any reversible suffix are absent from response, rendered UI, serialized state, and logs. |
| Notes/detail fields | Empty, exactly-at-limit, over-limit, HTML/script, control/framing, secret-like, and multiline values. Assert `MAX_NOTE_LENGTH=240`, safe sanitized/canonicalized detail-note behavior, unsafe-note omission, no original/full/raw note persistence, no `notes` or `handoffReason` in list, and only sanitized detail `notes` `<=240` plus safe detail `handoffReason` in detail. |
| Protected-field removal | Inject `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, secret/token/apiKey/authorization, unknown fields, raw transcript, raw TCP/frame/line, request/response bodies, tool calls, stack, and internal error text. Assert all are silently dropped/omitted and absent from every API success/error response and browser-visible/logged representation. |
| Ingestion auth | Valid `X-Adapter-API-Key`; missing, wrong, query/body credential, UI-cookie-only, and malformed header. Assert adapter secret is server-only and authorization occurs at the 4B boundary. |
| Dashboard API/page auth | Unauthenticated and invalid UI-cookie API calls; unauthenticated page navigation; valid UI-cookie API/page access; adapter-header-only access; cross-use of adapter/UI credentials. Assert separate UI cookie and secret boundaries. |
| Summary and filters | Known fixture expectations for every 4C summary calculation, zero/one/many results, boundary values, clear/reset, combined filters, and no hidden/internal field influence. |
| Fixture and ingestion | Repeated fixture reads are byte/value deterministic. A valid handoff-shaped raw ingestion is sanitized and reflected once; any repeated `callId`, including identical replay, is `409 DUPLICATE_CALL_ID` and not duplicated; invalid/unauthorized ingestion is not reflected; process/fresh-store reset behavior matches the documented in-memory limitation. |
| Empty/loading/error | Initial load, delayed response/loading, empty fixture/filter result, auth error, validation error, ingestion error, local-projection error, and safe GET refresh recovery where 4C defines it. No booking retry or raw diagnostics is allowed. |
| Demo booking | The exact predicate (`bookingSuccessful=true`, valid `bookingReference`, `outcome="SUCCESS"`, `mode="demo"`, `bookingStatus="BOOKED"`), allowlisted display fields, Demo/Mock label, and negative cases. Read-only/partial/non-booking results never satisfy the predicate. |
| Real booking disabled | Real-read-only or disabled configuration displays the exact unavailable state. Assert no `LOAD_BOOK`, mutation request, booking control, or real-booking reachability. |
| OTP unavailable | Required banner, safe copy, visibility in the relevant empty/detail/timeline state, and absence of an implied OTP verification or authorization. |
| Twin unavailable/fallback | Quota-failure/unavailable state, fallback banner/copy, fixture and ingestion display, restart/multi-instance limitation, and no native Twin claim. |
| Integration health | Centralized static capability/limitation items passed via server-safe props/config; Twin unavailable/quota fallback, OTP delivery unavailable, real `LOAD_BOOK` disabled, and loadboard/TMS read status only from an existing safe signal. Assert absent signals show `Unavailable`/`Not configured`, no `healthy`/`real` inference, no health endpoint/live check/TMS call, and all three mandatory banners remain. |
| No mutation controls | DOM/accessibility inspection for buttons, forms, links, keyboard actions, hidden controls, API actions, and route aliases that could book, cancel, retry a booking, or mutate operations. |
| API leakage review | Recursive response scan for raw transcript/TCP, secrets, internal pricing, full MC, original/full/raw or unsafe notes, stacks, unknown keys, request payloads, and credentials on success and all relevant errors; list must contain neither `notes` nor `handoffReason`, while detail may retain only sanitized/canonicalized `notes` `<=240` and a safe bounded detail `handoffReason`. |
| Phase 3 regression | Existing echo, search, detail, booking guard, adapter auth, DTO, mapper, parser, TCP fragmentation/fault/timeout/cleanup, policy, no-retry, resource, evidence, and real-mode denial tests remain green. |
| Real-execution exclusion | Review scripts, test configs, mocks, spies, network traces, and command history/evidence to prove no real TMS connection or `LOAD_BOOK` command ran. Never invoke any `test:real-tms:*` command. |

## README Final Scope

Update the README only after the route and behavior tests pass. It must contain the following, using exact names and semantics from the 4A–4C implementation:

- A route inventory with methods and paths: preserve the existing `/api/tms/echo`, `/api/tms/loads/search`, `/api/tms/loads/detail`, and `/api/tms/loads/book` contracts; add `POST /api/operations/calls`, `GET /api/operations/calls`, `GET /api/operations/calls/[callId]`, `GET /api/operations/summary`, the tested `POST /api/operations/auth/login` and `POST /api/operations/auth/logout` when required, and pages `/operations` and `/operations/calls/[callId]`. Do not add aliases or leave placeholders.
- Operations authentication: ingestion/adapter calls use `X-Adapter-API-Key` and the server-only adapter secret; dashboard page/API access uses the separate UI session cookie/secret. Explain that neither secret belongs in `NEXT_PUBLIC_*`, browser code, examples, logs, or query/body fields.
- Configuration names and safe example values: `ADAPTER_UI_DATA_MODE=fixture`, `ADAPTER_SHARED_SECRET=<local-or-deployment-secret>`, and `OPERATIONS_UI_SECRET=<local-or-deployment-secret>`. Never publish values, credentials, IDs, hostnames, tokens, or real load/MC data.
- The raw ingestion field names must remain exactly the handoff names; `callId`, `loadId`, and `agreedRate` are optional, with `loadId?: string | null` and `agreedRate?: number | null`; absence and `null` mean no match/no agreed rate and never produce invented data. The sanitizer derives canonical `fmcsaStatus`, `otpStatus`, `bookingStatus`, `handoffStatus`, `matchedLoads`, `mcMasked`, and `bookingReference`. Canonical modes are `demo` and `real-read-only`; canonical outcomes are `SUCCESS`, `OTP_DELIVERY_UNAVAILABLE`, `NO_MATCHING_LOAD`, `FAILED_NEGOTIATION`, `ALREADY_BOOKED`, `TECHNICAL_ERROR`, `HUMAN_HANDOFF`, and `BOOKING_NOT_ATTEMPTED`.
- Document the exact successful ingestion response `{ok:true,data:{callId,stored:true},meta:{requestId,source:"adapter-fallback"}}`, the canonical list/detail field names, and the summary fields `totalCalls`, `fmcsaverified`, `loadsMatched`, `demoBookings`, `failedNegotiations`, `handoffs`, `technicalErrors`, and `fmcsaVerificationRate`. List has no `notes`/`handoffReason`; detail may expose only sanitized/canonicalized `notes` `<=240` and a safe detail-only `handoffReason`.
- Fixture/demo mode versus real-read-only mode. State that `demo` is displayed as Demo/Mock and its success is deterministic local behavior, not provider evidence; `real-read-only` is displayed as Real Read-Only and never authorizes booking. `mock` and `fallback` are not `OperationsMode` values; `adapter-fallback` is only envelope metadata and `fixture|ingested` is only record provenance.
- The fallback store exists because Twin provisioning is unavailable/quota-limited. State that it is temporary, in-memory, non-persistent, process-local, and subject to Railway multi-instance/restart divergence. It is not native Twin and not a durable operational replacement.
- The AI Extract → canonical `POST` ingestion mapping, using the HappyRobot variable picker for each mapped variable: `response.mcNumber` → `mcNumber`, `response.loadId` → `loadId` when supplied, `response.agreedRate` → `agreedRate` when supplied, `response.fmcsaverified` → `fmcsaverified`, `response.otpVerified` → `otpVerified`, `response.bookingSuccessful` → `bookingSuccessful`, `response.bookingRef` → `bookingRef`, `response.outcome` → `outcome`, `response.handoffReason` → `handoffReason`, and `response.notes` → `notes`; map `response.callId` and `response.occurredAt` when supplied, plus only `response.origin`, `response.destination`, `response.equipment`, and `response.publishedRate` if implemented. Omit absent `loadId`/`agreedRate` rather than inserting invented values. Use the HappyRobot variable picker, never hardcoded `@` expressions, and do not imply that the adapter owns AI Extract.
- `LOAD_BOOK`/real booking is disabled. State that no operational mutation controls are exposed.
- OTP is unavailable and must remain an explicit unavailable state/banner. Do not claim verification or production readiness.
- Twin is unavailable; the fallback banner and limitations are the supported current behavior. Do not claim native Twin works.

README examples must be sanitized, reproducible in fixture mode, and consistent with the tested envelopes/statuses. Documentation must not imply persistence, multi-instance consistency, booking authority, provider confirmation, native Twin integration, or operational mutation support.

## Manual Browser QA Checklist

- [ ] Open the canonical login route and verify unauthenticated dashboard navigation follows the 4B page-auth behavior.
- [ ] Authenticate with the UI flow/cookie only; verify the dashboard loads and adapter credentials are never visible in DevTools, source, or client bundle.
- [ ] Verify the canonical dashboard route, fixture-mode table, deterministic ordering/values, summary cards, filters, clear/reset, detail view, and timeline.
- [ ] Verify ingestion through the documented adapter-header flow and confirm the allowed fixture-plus-ingestion result appears exactly once; a replayed `callId`, including identical payload, is a safe `409 DUPLICATE_CALL_ID` and never silently idempotent.
- [ ] Exercise empty, loading, validation/auth error, ingestion error, and local-projection/error recovery states; confirm no raw exception, transcript, TCP, secret, internal price, full MC, original/full/raw or unsafe note appears; verify list has no `notes`/`handoffReason` and detail alone may show the bounded sanitized note/reason.
- [ ] Verify demo booking success is labeled Demo/Mock and appears only under the complete canonical success predicate; isolated reference, attempt, HTTP 200, partial input, and real-read-only never count.
- [ ] Verify real-read-only/real-booking-disabled copy, the three mandatory banners (Twin quota fallback, OTP delivery unavailable, and Real `LOAD_BOOK` disabled), and their safe non-authorizing language. Verify static-props-only integration health shows `Unavailable`/`Not configured` without safe signals and makes no health/TMS call.
- [ ] Confirm there are no booking, cancel, retry-booking, mutation, or hidden/keyboard-accessible operational controls.
- [ ] Check responsive layouts at narrow, medium, and desktop widths; verify no sensitive data appears through overflow or tooltips.
- [ ] Navigate all interactive elements by keyboard; confirm visible focus, logical order, activation behavior, and no mutation action.
- [ ] Review network responses, cookies, DOM, hydration/client state, console output, and visible logs for the complete API leakage deny-list.

## Implementation Steps

1. Freeze the 4A–4C route, schema, auth, calculation, state, and copy inventory; record any mismatch as a blocker owned by the prior phase rather than silently changing the contract.
2. Add focused hardening tests for call validation, MC masking including short values, notes truncation/sanitization, protected-field removal, and complete response/log leakage.
3. Add route/auth tests proving adapter-header ingestion auth and the separate UI-cookie dashboard page/API auth boundary.
4. Add fixture determinism, fixture-plus-ingestion, fallback-store lifetime, summary/filter, and empty/loading/error tests.
5. Add dashboard behavior tests for demo-booking predicate/display, real-booking-disabled display, OTP/Twin banners, and absence of mutation controls.
6. Run the existing Phase 3 regression suite and inspect test configuration/imports/scripts for real TMS or `LOAD_BOOK` reachability. Do not run real-TMS scripts.
7. Perform the manual browser QA checklist and API/client/log leakage review on the tested build.
8. Update `README.md` to the observed final scope, including routes, auth, env names, AI Extract mapping, fallback limitations, demo/read-only distinction, OTP/Twin availability, and disabled booking.
9. Run the complete verification commands, review the diff and changed-file inventory, and prepare the release handoff report. Do not create a release commit until the post-phase gate passes.

## Verification Plan

### Required repository-local commands

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`

Run the commands against the existing package. Do not add a test framework, UI library, state library, or browser dependency merely for 4D. The build must remain compatible with Next 16 and React 19, including server/client boundaries, cookie auth, and absence of server secrets from the client bundle.

### Required evidence review

- [ ] Focused 4D tests and all existing Phase 3 tests pass.
- [ ] Manual browser QA is recorded for route/login, fixture/table/filter/detail/timeline, banners, empty/loading/error, responsive, keyboard, no-mutation-controls, and leakage review.
- [ ] Public API success/error responses, browser-visible state, cookies, client bundle, and captured logs contain no raw transcript/TCP, secrets, internal pricing, full MC, original/full/raw or unsafe notes, or unknown/internal fields; list contains no `notes`/`handoffReason`, while only approved sanitized/canonicalized detail `notes` `<=240` and safe detail `handoffReason` may appear.
- [ ] No real TMS endpoint, credential, socket, operation, or `LOAD_BOOK` command was used. `npm test` is the only test command permitted to run against the local suite; real-TMS scripts remain excluded.
- [ ] `README.md` matches the tested behavior and contains no secrets, IDs, unsupported claims, or native-Twin claim.
- [ ] Changed files are expected and limited to the approved Phase 4D hardening/docs scope; no generated or unrelated files are silently included.

## Post-phase Release Gate

Release is **GO** only when every gate below is checked:

This is the final automatic technical gate of the autonomous run, not an inter-phase human approval. A PASS is required before `@coder-heavy` creates the separate 4D implementation commit; the prior planning/spec commit does not satisfy this gate.

- [ ] All required commands pass: test, typecheck, lint, build, and `git diff --check`.
- [ ] Acceptance checklist items 1–20 below are individually mapped to a test, manual-QA observation, static review, or documented limitation.
- [ ] README routes, auth, env vars, AI Extract mapping, fixture/fallback behavior, demo/read-only distinction, disabled `LOAD_BOOK`, OTP unavailability, Twin quota limitation, and no-mutation scope match observed behavior.
- [ ] No unexpected files are present; the diff is reviewed for security, imports, client exposure, contract drift, and accidental feature scope.
- [ ] Review confirms no real TMS or `LOAD_BOOK` execution occurred.
- [ ] The handoff report records changed files, tests/commands, build result, manual QA, limitations, unresolved blockers, the planning/spec baseline hash, and all four phase hashes with their phase labels. Never invent or conflate a hash; report the actual commit SHA or the actual base/working-tree hash when uncommitted.
- [ ] After all gates PASS, `@coder-heavy` creates the separate 4D/release implementation commit: `docs(operations): finalize dashboard verification and integration docs`, and reports its actual 4D phase hash. No planner approval is required before this commit.

If any check fails, the result is **NO-GO/BLOCKED**: do not create the 4D commit and do not claim Phase 4 closure or advance to any subsequent release phase. The automatic circuit stops the run; no human intervention is required to trigger the stop. Return the defect to the owning prior phase—4A for foundation/fallback boundaries, 4B for API/schema/auth/ingestion boundaries, 4C for UI/state/display/accessibility boundaries, or Phase 3 for TCP/TMS/real-booking contract or leakage regressions. Do not weaken a gate to obtain a green result.

## Acceptance Criteria — Handoff Criteria 1–20

- [ ] **1. Scope closure:** Phase 4D changes only hardening, tests, docs, and release verification; no new feature or contract is introduced.
- [ ] **2. Call validation:** Ingestion accepts the exact handoff raw schema, drops unknown/forbidden keys silently, rejects malformed approved values/unsafe MC safely, and prevents unauthorized or invalid state mutation.
- [ ] **3. MC masking:** Supplied `mcNumber` becomes only `MC•••<suffix>` with at most the final three visible characters (one/two for short values); invalid supplied MC rejects safely and full MC never appears in APIs, UI, state, logs, or errors.
- [ ] **4. Notes safety:** `notes` are bounded by `MAX_NOTE_LENGTH=240`, sanitized/canonicalized, omitted when unsafe, absent from list, and permitted in detail only as the resulting safe text; they are never retained or returned in original/full/raw form. `handoffReason` is likewise a safe detail-only field and never appears in list or raw form.
- [ ] **5. Protected-field removal:** `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, secrets/token/apiKey/authorization, unknown fields, raw request/response bodies, tool calls, raw transcript, and raw TCP are dropped/omitted constructively.
- [ ] **6. API leakage:** No public response contains raw transcript/TCP, secrets, internal pricing, full MC/`mcNumber`, original/full/raw or unsafe notes, stacks, or internal fields; list contains no `notes`/`handoffReason`, and detail may contain only the 4A-sanitized/canonicalized `notes` `<=240` and safe detail `handoffReason`.
- [ ] **7. Ingestion auth:** Ingestion requires the adapter header and server-only adapter secret; UI auth cannot substitute for it.
- [ ] **8. Dashboard API auth:** Dashboard APIs require the separate UI cookie/secret boundary and return the established safe unauthenticated result.
- [ ] **9. Dashboard page auth:** The dashboard page follows the established login/redirect/session behavior without exposing secrets to the browser.
- [ ] **10. Summary calculations:** All 4C summary calculations match tested fixture expectations, use canonical records rather than the limited table, and expose the seven required count fields `totalCalls`, `fmcsaverified`, `loadsMatched`, `demoBookings`, `failedNegotiations`, `handoffs`, and `technicalErrors`, plus `fmcsaVerificationRate` without replacing `fmcsaverified`.
- [ ] **11. Filters:** All 4C filters, combinations, clear/reset behavior, ordering, and empty results are correct and leakage-free.
- [ ] **12. Fixture determinism:** `ADAPTER_UI_DATA_MODE=fixture` is deterministic across reloads and fresh test runs.
- [ ] **13. Fixture plus ingestion:** Valid handoff-shaped raw ingestion maps once to a canonical record; duplicate `callId` (including identical replay) is `409 DUPLICATE_CALL_ID` with no overwrite; invalid/unauthorized ingestion has no visible side effect.
- [ ] **14. UI states:** Empty, loading, and error states are distinct, safe, accessible, and documented.
- [ ] **15. Demo booking:** Only `bookingSuccessful === true` + valid `bookingReference` + `outcome === "SUCCESS"` + `mode === "demo"` + `bookingStatus === "BOOKED"` renders Demo/Mock success; it is never presented as provider evidence.
- [ ] **16. Real booking disabled:** Real booking and `LOAD_BOOK` remain disabled, unreachable, and visibly unavailable.
- [ ] **17. Availability banners:** The UI explicitly shows the three mandatory limitation banners **Twin quota fallback**, **OTP delivery unavailable**, and **Real `LOAD_BOOK` disabled**; all copy is accurate, visible, and non-authorizing. Integration health uses only static server-safe props/config, shows `Unavailable`/`Not configured` without a safe signal, and adds no health endpoint/live check.
- [ ] **18. No mutation controls/regressions:** No booking or operational mutation controls exist, and all Phase 3 regressions pass.
- [ ] **19. Documentation:** README route/auth/env/mapping/scope/limitation claims exactly match tested behavior and publish no secrets/IDs or native-Twin claim.
- [ ] **20. Release evidence:** Commands, browser QA, leakage/security review, changed-file inventory, limitations, the separately identified planning/spec baseline hash, all four phase hashes, rollback decision, and planner/reviewer handoff are complete.

## Rollback and Safety Rules

- Roll back only the Phase 4D hardening/documentation changes that caused the failure; preserve the last known-good 4A–4C contracts and Phase 3 safety gates.
- A documentation-only rollback restores the previous README while retaining tested security fixes unless those fixes are independently unsafe.
- If auth, leakage, state, calculation, or UI behavior fails, stop the release and return to the owning prior phase. Do not compensate by weakening validation, masking, cookie separation, or response allowlists.
- Keep the fallback store explicitly temporary, in-memory, and non-persistent. Do not replace it with an unapproved persistence/Twin implementation in 4D.
- Keep real-read-only distinct from real booking. Never add an enable flag, mutation control, retry, unbooking, compensation, or `LOAD_BOOK` execution as a workaround.
- If Twin provisioning remains unavailable, retain the unavailable/fallback banner and truthful limitation; never silently present the fallback as native Twin.

## Handoff to Planner and Reviewer

## Handoff to `@coder-heavy`

The executor receives a clean baseline whose prior/base commit already contains the single planning commit fixing all five Phase 4 specs; record that planning/spec hash separately from the phase hashes. It is a pre-run exception, not a 4D or inter-phase implementation commit. A normal autonomous run has exactly four phase commits, 4A through 4D; no additional commits or squash/merge are made during the run except the documented, phase-attributed blocking correction allowed by the index, with preference to stopping without a commit when a phase fails.

Implement Phase 4D as the final stage of the single autonomous Phase 4 run, only after 4A, 4B, and 4C each have automatic gate PASS and an observed phase commit/hash. The exact allowlist is `README.md`, `tests/operations/**`, and focused edits to already-approved 4A–4C files only when a failed test proves the correction is needed. Do not create a new route/module/report artifact or modify `src/tms/**`, `mock/**`, `.env`, unrelated config, or unrelated product files. Use only local fixtures, the process-scoped in-memory store, and fake seams; never run real TMS, real sockets, provider calls, credentials, or `LOAD_BOOK`. The planner performs only the initial handoff and does not implement product code or approve between phases. Do not skip or reorder phases. After the final post-phase gate PASS, create the separate 4D implementation commit and record its actual phase hash; there is no subsequent phase. A normal run has exactly four phase commits; no additional commits or squash/merge are made during the run except the documented, phase-attributed blocking correction allowed by the index, with preference to stopping without a commit on failure. Stop and report **BLOCKED/NO-GO** for contract drift, sensitive leakage, auth bypass, unknown-field reflection, duplicate idempotency, mutation controls, an unverifiable requirement, or real reachability; do not create the failed-phase commit or claim release readiness.

The implementation/release owner must hand off to `@planner-heavy` and the designated reviewer with:

- The 1–20 acceptance matrix mapped to concrete test names, manual QA observations, and static/security evidence.
- The exact changed-file inventory and diff/security review result.
- Results for `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
- Manual browser QA and API/client/log leakage findings.
- README verification, fallback/Twin/OTP limitations, demo/read-only boundary, and confirmation that no real TMS/`LOAD_BOOK` ran.
- The planning/spec baseline hash, the four phase hashes labeled 4A/4B/4C/4D (with the 4D hash as source/release hash), known limitations, unresolved blockers, and rollback recommendation.

The planner confirms scope and phase ownership, and the reviewer confirms security, contract preservation, UI states, documentation truth, and release evidence only after the autonomous run has completed 4D, its fourth phase commit/report exists, and the prior planning/spec hash is distinguished from the four phase hashes. A failed or incomplete final review is **NO-GO** and must return to the owning prior phase; it does not create an inter-phase approval gate and does not retroactively combine the four commits.
