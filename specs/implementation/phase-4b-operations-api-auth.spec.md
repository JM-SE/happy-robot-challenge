# Phase 4B — Operations API and Authentication Specification

**Status:** **PLAN READY — API/SECURITY ONLY — NOT IMPLEMENTED**

## Context

Phase 4B depends on [`phase-4a-operational-foundation.spec.md`](./phase-4a-operational-foundation.spec.md) and the existing Phase 3 HTTP, envelope, request-ID, adapter-auth, bounded-input, and safe-error contracts. Phase 4A is the authoritative sanitizer and canonical operational-record boundary. Phase 4B exposes only the protected Operations API and the minimum server-side authentication needed to consume it.

The adapter remains a local projection for this phase because the external source is unavailable. `OperationsMode` is exactly `demo | real-read-only`; `Demo/Mock` is a UI label for `demo`, `adapter-fallback` is only envelope `meta.source`, and `fixture | ingested` is only record provenance. No real TMS operation or real `LOAD_BOOK` is reachable. No UI composition, FMCSA/OTP/negotiation implementation, TCP change, or TMS client change is in scope. HappyRobot owns the upstream call workflow; Operations owns safe ingestion, storage access, filtering, summary projection, and protected access.

Phase 4B is the second stage of the same autonomous `@coder-heavy` execution: it starts only after 4A's automatic technical gate PASS and 4A phase commit/hash from the run. The single planning commit containing all five Phase 4 specs is a prior baseline prerequisite, not a same-run phase commit and not an inter-phase commit. After its own gate and separate 4B phase commit, execution continues to 4C automatically. No planner approval is expected between these stages, and phases may not be skipped or reordered.

### Scope

- Add the four required Operations routes:
  - `POST /api/operations/calls`
  - `GET /api/operations/calls`
  - `GET /api/operations/calls/[callId]`
  - `GET /api/operations/summary`
- Use `X-Adapter-API-Key` / server-only `ADAPTER_SHARED_SECRET` for ingestion and wire `ADAPTER_UI_DATA_MODE` only at this phase.
- Protect Operations reads and the existing `/operations` server page with a separate UI session.
- Reuse the Phase 4A sanitizer/store boundary and expose only constructive, bounded DTOs.
- Add `POST /api/operations/auth/login` and `POST /api/operations/auth/logout` only as the minimum session boundary when the repository has no equivalent mechanism; do not add OAuth, roles, accounts, or a new UI.

### Explicit non-goals

- No UI markup, dashboard components, client-side auth state, or visual work; `/operations` receives only a server-side access guard.
- No modification to `/api/tms` routes, envelopes, auth, client, parser, transport, deadlines, limits, mock server, policy, or `LOAD_BOOK` paths.
- No TMS lookup, load enrichment call, raw load/log ingestion, transcript storage, secret storage, or real-provider/booking evidence.
- No OAuth, roles, multi-tenant authorization, password reset, or general-purpose session framework.

## Dependencies / Inputs

- [ ] Phase 4A operational foundation, including its sanitizer, canonical `CallRecord` shape, derived statuses/load summaries, duplicate conflict behavior, bounded limits, and in-memory store contract, has an automatic gate PASS and an observed 4A phase commit/hash from this run; the planning/spec commit is tracked separately.
- [ ] Existing Phase 3 HTTP envelopes, request-ID propagation, adapter authentication, safe error mapping, and response security headers.
- [ ] Existing server runtime and `/operations` page, if present; only its server authorization guard may be changed.
- [ ] Server-only `ADAPTER_SHARED_SECRET`; it remains distinct from `OPERATIONS_UI_SECRET`.
- [ ] No credentials, raw records, raw TCP frames/lines, transcripts, secrets, `MAX_BUY`, or operational payloads in source, tests, logs, examples, or this specification. `mcNumber` is accepted only as a raw input key and never as canonical/output data.

If a Phase 4A contract conflicts with this document, stop and resolve the contract before coding. Do not create a second sanitizer, duplicate record model, or alternate duplicate policy in 4B.

## Requirements

### Ingestion authentication and transport

- [ ] `POST /api/operations/calls` requires `X-Adapter-API-Key` authenticated against server-only `ADAPTER_SHARED_SECRET`. Header lookup remains case-insensitive, but the secret is never returned, serialized, logged, or placed in browser-exposed configuration.
- [ ] A UI cookie never substitutes for the adapter header. Cookie-only, query-only, body-only, or request-ID-only ingestion is `401 ADAPTER_UNAUTHORIZED`; the request must not be stored.
- [ ] The adapter secret is checked through the existing Phase 3 constant-time-safe adapter-auth boundary. Do not implement a second comparison or read raw env in the route.
- [ ] The route uses the existing bounded JSON/content-type/method/request-ID pipeline. Invalid transport/auth requests stop before store/domain work and do not echo input.
- [ ] All Operations responses use `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store, private`, `Pragma: no-cache`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and an equivalent frame-denial header where supported. Protected GETs also vary safely on `Cookie`.

### Exact ingestion DTO and sanitizer boundary

The request body is the raw handoff object. Its approved keys are exactly the following; `callId`, `loadId`, and `agreedRate` are optional, and `loadId`/`agreedRate` accept `null`:

```ts
type OperationsCallIngestionInput = {
  callId?: string;
  occurredAt: string;
  mcNumber: string;
  loadId?: string | null;
  agreedRate?: number | null;
  fmcsaverified: boolean;
  otpVerified: boolean;
  bookingSuccessful: boolean;
  bookingRef: string | null;
  outcome: CallOutcome;
  handoffReason: string | null;
  notes: string;
  mode: OperationsMode;
  technicalStatus: TechnicalStatus;
  origin?: string;
  destination?: string;
  equipment?: string;
  publishedRate?: number;
};
```

The accepted handoff-shaped example is:

```json
{"callId":"optional-external-call-id","occurredAt":"2026-08-29T20:00:00Z","mcNumber":"123456","loadId":"LOAD-001","agreedRate":2150,"fmcsaverified":true,"otpVerified":false,"bookingSuccessful":false,"bookingRef":null,"outcome":"OTP_DELIVERY_UNAVAILABLE","handoffReason":null,"notes":"Sanitized operational summary","mode":"demo","technicalStatus":"SUCCESS"}
```

- [ ] `callId` is optional input. When absent, the server generates a bounded unique `callId`; it is never derived from or equal to `requestId`.
- [ ] `occurredAt` is a valid bounded UTC ISO timestamp. `mcNumber`, `loadId`, `bookingRef`, `handoffReason`, `notes`, and enrichment text are validated by the 4A sanitizer. Absent or `null` `loadId` produces no matched load and no invented identifier. The full raw `mcNumber` is never returned; canonical output uses only `mcMasked`.
- [ ] `agreedRate` is an optional JSON number or `null`; when numeric, and when `publishedRate` is present, it is finite, positive, bounded by the named Operations rate limit, and limited to two decimal places. Absent or `null` means no agreed rate and is never replaced by a default, calculated, published, or other invented value. Numeric strings, `NaN`, infinities, silent rounding, coercion, and clamping fail safely. `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, and internal pricing are never accepted as canonical aliases or retained.
- [ ] `fmcsaverified`, `otpVerified`, and `bookingSuccessful` are actual booleans. `bookingRef` and `handoffReason` are nullable strings, not arbitrary objects.
- [ ] `outcome`, `mode`, and `technicalStatus` are the exact uppercase closed enums from 4A. `bookingSuccessful=true` and `outcome="SUCCESS"` both require the complete booking tuple; an isolated `bookingRef`, HTTP 200, tool invocation, or booking attempt never counts. `real-read-only` never has booking success or reference. Inconsistent combinations fail with a generic safe validation error.
- [ ] The optional enrichment decision is deliberately narrow: allow only the four optional top-level scalar fields `origin`, `destination`, `equipment`, and `publishedRate`, with bounded safe text/numeric validation. They may appear in detail output; they are not a license to accept a nested `load`, `rawLoad`, `log`, `payload`, `transcript`, `rawTcp`, or other record blob. No `enrichment` object is accepted.
- [ ] The 4A sanitizer is the only data-sensitivity boundary: `unknown body -> bounded JSON reader -> 4A sanitizer -> typed semantic checks -> store`. Routes must not destructure, spread, persist, or map the raw body before sanitization.
- [ ] Unknown and forbidden keys, including `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, secrets, token/apiKey/authorization, transcript/rawTranscript/rawTcp/rawFrame(s), payload/requestBody/responseBody, toolInvocation/toolCall, and canonical `mcNumber`, are silently dropped before persistence without reflecting key/value in error, log, or response. Malformed approved values produce a generic safe `400`; unsafe notes are omitted by 4A.
- [ ] Public/internal mappings are constructive allowlists. No object spread, raw payload, stack, exception message, raw log, raw TCP data, secret, `MAX_BUY`, or internal rate crosses the sanitizer, store, response, or log boundary.

### Duplicate ingestion

- [ ] Delegate duplicate handling to the exact Phase 4A `CallEventStore`: every repeated `callId`, including an identical replay, is a safe `DUPLICATE_CALL_ID` conflict. There is no second insert, upsert, overwrite, dedupe, or implicit idempotency.
- [ ] The API maps `DUPLICATE_CALL_ID` to HTTP `409` with a safe conflict envelope and does not reveal which field or payload caused the conflict.
- [ ] Generated IDs and duplicate detection are independent of `requestId`; every request still receives its own bounded correlation ID.

### Stable envelopes and correlation

Every Operations route returns the existing safe envelope shape:

```json
{"ok":true,"data":{},"meta":{"requestId":"...","source":"adapter-fallback"}}
```

```json
{"ok":false,"error":{"code":"SAFE_ERROR_CODE","message":"Stable public message.","retryable":false},"meta":{"requestId":"...","source":"adapter-fallback"}}
```

- [ ] `POST /api/operations/calls` responds exactly with `{ok:true,data:{callId,stored:true},meta:{requestId,source:"adapter-fallback"}}`; `callId` is the generated or accepted canonical ID and `stored` is always a boolean.
- [ ] A bounded accepted/generated `X-Request-ID` is returned in the response header and `meta.requestId`; invalid supplied IDs use the established Phase 3 safe behavior. `requestId` is correlation only, never auth or a call identity.
- [ ] `meta.source` is server-generated and equals `"adapter-fallback"` on ingestion, reads, auth responses, and safe errors. It is never client-controlled and never implies TMS/provider execution.
- [ ] Errors use centralized stable mappings such as `MALFORMED_JSON`, `VALIDATION_ERROR`, `ADAPTER_UNAUTHORIZED`, `OPERATIONS_UNAUTHORIZED`, `OPERATIONS_CALL_NOT_FOUND`, `DUPLICATE_CALL_ID`, `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE`, `REQUEST_TOO_LARGE`, and `CONFIGURATION_UNAVAILABLE`. Do not reflect query/body keys, secrets, IDs, raw exceptions, stacks, or upstream text.

### Read APIs and deterministic filtering

- [ ] `GET /api/operations/calls`, `GET /api/operations/calls/[callId]`, and `GET /api/operations/summary` require the UI session described below. A valid adapter header alone does not authorize GETs; a UI cookie alone does not authorize ingestion.
- [ ] `GET /api/operations/calls` accepts only bounded query parameters `limit`, `outcome`, `fmcsaStatus`, `otpStatus`, `bookingStatus`, `mode`, `from`, and `to`. Unknown or malformed query parameters fail safely without a TMS/store bypass.
- [ ] `limit` defaults to named `DEFAULT_OPERATIONS_LIMIT=50` and cannot exceed named `MAX_OPERATIONS_LIMIT=200` (or stricter existing 4A bounds). `from`/`to` are inclusive bounded UTC `YYYY-MM-DD` dates, require `from <= to`, and cannot describe more than the named maximum range of 366 days.
- [ ] Filter values are closed and use the exact canonical enum values: `fmcsaStatus=VERIFIED|UNAVAILABLE|FAILED|NOT_RUN`, `otpStatus=VERIFIED|UNAVAILABLE|FAILED|NOT_RUN`, `bookingStatus=NOT_REQUESTED|BOOKED|ALREADY_BOOKED|FAILED`, plus exact `CallOutcome` and `OperationsMode` values. Do not accept booleans, lower-case aliases, raw provider statuses, TMS query fields, or arbitrary expressions.
- [ ] List ordering is deterministic: `occurredAt` descending, then `callId` ascending for ties. The limit is applied after filtering and sorting. No TMS call, socket, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, or TMS client construction occurs on any read path.
- [ ] List success is `{ok:true,data:{calls:OperationsCallListItem[]},meta:{requestId,source:"adapter-fallback"}}`. Items are sanitized allowlists only and contain canonical safe fields; list contains neither `notes` nor `handoffReason`. Detail-only `notes` must be sanitized/canonicalized text of `<=240` characters, never original/full/raw note; `handoffReason` is only a safe bounded detail field.
- [ ] `GET /api/operations/calls/[callId]` accepts only a bounded safe path ID and returns `{ok:true,data:{call:OperationsCallDetail},meta:{requestId,source:"adapter-fallback"}}` for one sanitized record. Unknown or malformed IDs return a generic safe `404 OPERATIONS_CALL_NOT_FOUND`/validation error without reflecting the ID.
- [ ] `GET /api/operations/summary` has no TMS dependency and returns under `data.summary` the seven count fields plus the safe additional `fmcsaVerificationRate`: `totalCalls`, `fmcsaverified`, `loadsMatched`, `demoBookings`, `failedNegotiations`, `handoffs`, `technicalErrors`, and `fmcsaVerificationRate`. The seven counts are bounded non-negative integers; the rate is a `0..1` ratio or `null` and never replaces `fmcsaverified`. No secret, raw log, raw load, `MAX_BUY`, transcript, or TCP data is included.
- [ ] Summary derivation is canonical and deterministic over all matching sanitized records: `fmcsaverified` counts `fmcsaStatus=VERIFIED`; FMCSA denominator is `VERIFIED + UNAVAILABLE + FAILED`, excluding `NOT_RUN`; `fmcsaVerificationRate` is the verified count divided by that denominator or `null`; `loadsMatched` counts calls with at least one matched load; `demoBookings` uses the complete success tuple; `failedNegotiations` is exact `FAILED_NEGOTIATION`; `handoffs` is outcome `HUMAN_HANDOFF` OR handoff requested/completed, once per call; `technicalErrors` is technical status non-success OR outcome `TECHNICAL_ERROR`. Do not calculate from the bounded table, raw text, or TMS state.

### Data-mode composition

- [ ] `src/operations/config.ts` is the only server-only reader of `ADAPTER_UI_DATA_MODE`. `fixture` seeds a fresh deterministic `createDemoFixtures()` set and accepts subsequent sanitized ingestion in the same process-scoped store.
- [ ] An unset or empty value may start the store empty. Any non-empty value other than `fixture` fails closed with a generic configuration error; no request query, header, body, cookie, or client code can select the mode.
- [ ] `source: "fixture" | "ingested"` remains a record field. Envelope `meta.source: "adapter-fallback"` remains response metadata and is never copied into `CallRecord`.
- [ ] Railway restart/process restart loses records and multiple instances diverge; this limitation is explicit and is not repaired with DB, Twin, persistence, upsert, or idempotency.

### UI session authentication

- [ ] If no existing safe Operations session exists, add the minimum server-only boundary using `OPERATIONS_UI_SECRET`, which is separate from `ADAPTER_SHARED_SECRET` and never falls back to it. Missing/blank configuration fails closed.
- [ ] `POST /api/operations/auth/login` accepts only a bounded JSON body `{ "secret": string }`, over HTTPS in production. It compares against `OPERATIONS_UI_SECRET` using constant-time verification where appropriate, returns a generic unauthorized error for incorrect input, and never reflects/logs the submitted or configured secret.
- [ ] A successful login issues a signed/HMAC, expiring HTTP-only cookie containing only bounded non-secret claims such as version/issued-at/expiry/nonce and signature; the raw UI secret is never in the cookie. Use a fixed bounded maximum age, recommended `OPERATIONS_SESSION_MAX_AGE_SECONDS=28800` (8 hours), with no client override.
- [ ] The session cookie is `HttpOnly; SameSite=Lax; Path=/`; it is `Secure` in production. Verification rejects tampering, malformed claims, expired sessions, excessive lifetime, and invalid signatures using fixed-size constant-time comparison where applicable.
- [ ] `POST /api/operations/auth/logout` clears the session cookie with matching path/attributes and returns a safe no-store envelope. It does not disclose session contents. Stateless sessions remain bounded by expiry; no roles or OAuth are introduced.
- [ ] The `/operations` server page calls the session helper before rendering and redirects unauthorized requests to the fixed login surface (for example `/operations/login`) without an open redirect or user-controlled return target. No page markup or client-side secret handling is part of 4B.
- [ ] The three Operations GET APIs return safe `401 OPERATIONS_UNAUTHORIZED` when the UI session is missing/invalid. Login/configuration failures do not disclose whether a secret exists or why verification failed.
- [ ] Neither `ADAPTER_SHARED_SECRET` nor `OPERATIONS_UI_SECRET` is exposed to browser JavaScript, `NEXT_PUBLIC_*`, response data, logs, query strings, or error text. The only permitted browser exposure is the transient login submission over HTTPS.
- [ ] Any route using Node crypto/cookie primitives explicitly declares the Node runtime (for example `runtime = "nodejs"`) rather than relying on an Edge runtime with incompatible APIs.

## Files / Modules and Responsibility Boundaries

Names may adjust only if the boundaries remain equivalent:

| Location | Responsibility | Must not own |
| --- | --- | --- |
| `src/operations/api-contract.ts` | Closed Operations DTOs, enums, envelopes, source value, status codes, headers, filter names, and named bounds. | IO, raw env, auth comparison, store state, or route logic. |
| `src/operations/operations-auth.ts` | Server-only selection of the adapter-auth boundary and UI-secret policy; separate ingestion/header auth from UI-session auth. | UI rendering, raw response construction, TMS/TCP IO, or secret logging. |
| `src/operations/session-helper.ts` | HMAC/signed cookie creation, parsing, expiry, constant-time verification, logout cookie, and fixed session lifetime. | Adapter-secret fallback, roles, OAuth, raw payload persistence, or client code. |
| `src/operations/operations-dto.ts` (or equivalent DTO parser) | Query/path parsing and typed post-4A ingestion validation/semantic checks. | Reading secrets, persistence, TMS calls, or mapping raw body before 4A sanitization. |
| `src/operations/response-mapper.ts` (or equivalent) | Constructive list/detail/summary and safe-error data mapping, including `source`. | Raw object spread, sanitization replacement, auth, or IO. |
| `src/operations/store.ts` | Sole Operations read/insert abstraction over the Phase 4A canonical sanitized store. | Raw body/log/TMS data, duplicate policy different from 4A, upsert/idempotency, network IO, or secret access. |
| `app/api/operations/calls/route.ts` | Thin POST ingestion and GET list orchestration through shared pipeline/auth/DTO/store/mapper. | Raw env, cookie-as-adapter-auth, business rules, TMS/TCP, logging implementation, or status tables. |
| `app/api/operations/calls/[callId]/route.ts` | Thin UI-session-protected detail orchestration. | TMS detail lookup, raw record mapping, or auth implementation. |
| `app/api/operations/summary/route.ts` | Thin UI-session-protected summary orchestration over sanitized store aggregates. | TMS queries, raw aggregation, secret/config serialization, or UI concerns. |
| `app/api/operations/auth/{login,logout}/route.ts` | Minimal session endpoint orchestration, if required. | Adapter auth substitution, raw secret logging, OAuth, or UI markup. |
| Existing `app/operations/**` page | Server-side session guard/redirect only. | New UI, client-side secret, dashboard behavior, or data-fetching redesign. |

Do not alter existing `/api/tms` files, `src/tms/client.ts`, parser, transport, mock server, or booking paths for this phase. Routes may reuse shared Phase 3 auth/envelope helpers but must not import a TMS client or direct TCP/TMS seam.

## Module Boundaries / Contracts

- **Ingestion flow:** `Request -> bounded Phase 3 pipeline -> adapter header auth -> 4A sanitizer -> typed canonical record -> 4A store.insert -> allowlisted response`; raw body is never mapped before sanitization.
- **Read flow:** `Request -> bounded request context -> UI session verification -> bounded query/path parser -> sanitized store read/filter/sort -> response mapper -> no-store envelope`.
- **Summary flow:** `Request -> UI session verification -> store aggregate over all matching sanitized records -> seven handoff fields plus fmcsaVerificationRate`; it must never ask TMS for current state.
- **Auth separation:** adapter authentication and UI session authentication have different secrets, helpers, cookie/header inputs, and failure codes. Neither boundary accepts the other as a substitute.
- **Data separation:** only the 4A sanitizer can convert untrusted call data to the canonical stored record. The store never receives raw input; response mappers receive canonical records and construct DTOs field-by-field.
- **Configuration separation:** route handlers receive typed auth/session decisions. They do not read `process.env`; raw env snapshots and secret providers remain server-only inside auth/config helpers.
- **Error separation:** all errors become stable safe envelopes with bounded `requestId` and `source`; no field name/value, secret, exception, stack, raw log, or raw TCP text crosses the boundary.

### Closed response records

`OperationsCallListItem` contains only the canonical safe business fields needed for a list: `callId`, `occurredAt`, `source`, optional `mcMasked`, optional `loadId` (the safe matched-load ID), optional `agreedRate`, `fmcsaStatus`, `otpStatus`, `bookingStatus`, `bookingSuccessful`, optional `bookingReference`, `outcome`, `handoffStatus`, `mode`, and `technicalStatus`. It never returns raw `mcNumber` or detail-only enrichment.

`OperationsCallDetail` contains the same canonical fields plus bounded `matchedLoads` (`loadId`, optional `origin`, `destination`, `equipment`, `publishedRate`), bounded canonical `timeline`, optional safe bounded `handoffReason`, optional sanitized/canonicalized `notes` of `<=240` characters, and the safe record `source` label. List contains neither `notes` nor `handoffReason`; detail never contains the original/full/raw note. Both types are constructed field-by-field. They never contain `mcNumber`, `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, secrets, tokens, raw load/log objects, transcript, `rawTcp`, request/response bodies, stacks, or provider/TMS payloads.

## Technical Approach

Implement a small additive Operations adapter on top of Phase 4A. Freeze the closed contract and named bounds first. Reuse the Phase 3 request-ID, bounded JSON, adapter-auth, envelope, and security-header helpers; reuse the 4A sanitizer and exact four-method store rather than copying their logic. Keep route handlers as orchestration only.

The only permitted ingestion source is the adapter header. The only permitted read source is the signed UI session. All read behavior is local to the sanitized Operations store. `source:"adapter-fallback"` identifies this local adapter projection and is not evidence of TMS access, a real booking, or provider confirmation.

No API route may instantiate `TmsClient`, open a socket, invoke `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, read raw TMS records, or import the TCP/mock-server path. Any dependency or request that would make real TMS/booking reachable is a blocker.

## Implementation Steps

1. Confirm the Phase 4A sanitizer, canonical record, store, named bounds, and `DUPLICATE_CALL_ID` conflict semantics; resolve conflicts before adding any 4B type or route.
2. Add/finalize `src/operations/api-contract.ts` with the exact ingestion allowlist, closed enums, read DTOs, summary fields, envelopes, `source`, status codes, header policy, and bounded constants.
3. Wire `operations-auth.ts` to the existing adapter-header verifier for POST ingestion and create the separate `OPERATIONS_UI_SECRET` policy only if an equivalent safe UI session does not already exist.
4. Implement the Node-runtime session helper with expiring signed/HMAC HTTP-only cookie, constant-time verification, production `Secure`, fixed `SameSite=Lax`/`Path=/`, logout clearing, and no raw secret claims.
5. Implement the DTO/parser boundary so sanitized input is validated without raw-body spreading; parse only the allowlisted filters/path ID and enforce semantic consistency, dates, rates, enum values, and bounds.
6. Compose the 4A canonical store with `fixture` seeding and sanitized ingestion. Every duplicate `callId`, including same-payload replay, is a `DUPLICATE_CALL_ID` conflict; do not add a second store, upsert, idempotency, or TMS fallback.
7. Add the four required thin route handlers and minimal login/logout routes if needed. Add only the `/operations` server guard/redirect; do not implement or redesign UI.
8. Add focused auth, cookie, DTO/sanitizer, duplicate-conflict, list/detail/summary, headers/request-ID/source, no-TMS, leakage, mode, and static-boundary tests.
9. Run the full verification and post-phase security/file review. Report the observed 4B phase commit hash (or explicitly report that no 4B phase commit was created), alongside the separately inherited planning/spec commit hash; do not claim or conflate hashes that were not observed.

## Test Plan

### Ingestion, DTO, and sanitizer tests

- [ ] Missing, incorrect, query/body-only, and UI-cookie-only adapter auth return `401 ADAPTER_UNAUTHORIZED`; a correct `X-Adapter-API-Key` stores only sanitized data.
- [ ] The secret is not present in response bodies, headers other than the expected auth input, logs, errors, browser-visible env, or captured request records. TMS auth remains unrelated and untouched.
- [ ] Exact required/optional DTO fields, including `loadId?: string | null` and `agreedRate?: number | null`, booleans, nullable fields, ISO timestamp, rates, closed outcome/mode/technical-status values, semantic consistency, bounded text, and invalid JSON/types are covered. Tests prove omission and `null` have identical no-match/no-agreed-rate semantics and never invent values.
- [ ] Unknown and forbidden `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, secrets/token/apiKey/authorization, transcript/rawTranscript/rawTcp/rawFrame(s), payload/requestBody/responseBody, toolInvocation/toolCall, canonical `mcNumber`, aliases, and nested raw-load/log objects are silently dropped before storage and never reflected; forbidden notes are omitted.
- [ ] Tests prove the 4A sanitizer is the sole untrusted-data boundary and that no route/store/mapper uses raw input or object spread.
- [ ] Missing `callId` generates a distinct bounded ID; supplied safe IDs are preserved; `callId` is never `requestId`.
- [ ] Any repeated `callId`, including identical canonical input, returns `409 DUPLICATE_CALL_ID`; no second record, overwrite, upsert, or implicit idempotency occurs, and no field difference leaks.

### UI session and route authorization tests

- [ ] Missing, expired, malformed, tampered, wrong-secret, and overlong cookies cannot access all three GET APIs; adapter header alone cannot access them.
- [ ] Login accepts only the bounded transient secret body, returns a signed expiring HTTP-only cookie, and never exposes/logs either secret. Wrong login is a generic unauthorized response.
- [ ] Cookie tests assert bounded expiry, HMAC/signature verification, constant-time comparison where applicable, `HttpOnly`, `SameSite=Lax`, `Path=/`, production-only `Secure`, and logout clearing.
- [ ] `/operations` redirects unauthorized requests to the fixed login surface with no open redirect; authorized server requests pass. No UI markup/client secret test is introduced.
- [ ] UI secret and adapter secret are distinct configuration inputs; missing/blank values fail closed and never fall back to one another.

### Read contract tests

- [ ] List default/max/over-limit behavior, all filters, inclusive date range, invalid/unknown query values, no-query behavior, deterministic ordering, and post-filter limit are covered.
- [ ] List and detail outputs contain only their exact sanitized allowlists. List contains no `notes` or `handoffReason`; detail may include only sanitized/canonicalized `notes` `<=240` and a safe bounded `handoffReason` plus the four approved enrichment scalars; neither path returns the original/full/raw note or raw load/log/TCP data.
- [ ] Unknown detail IDs return safe not-found without ID reflection. No GET performs TMS client construction, TMS calls, socket activity, or mock TCP activity.
- [ ] Summary returns the seven count fields `totalCalls`, `fmcsaverified`, `loadsMatched`, `demoBookings`, `failedNegotiations`, `handoffs`, and `technicalErrors`, plus `fmcsaVerificationRate`, with canonical counts/formulas and no extra protected fields; the rate is a ratio/null and does not replace `fmcsaverified`.
- [ ] All success/error responses assert stable envelopes, `meta.requestId`, `meta.source="adapter-fallback"`, `X-Request-ID`, no-store/security headers, and safe non-reflective errors; record `source` remains separate as `fixture|ingested`.

### Static and regression tests

- [ ] Static/import checks prove Operations routes do not import `TmsClient`, TCP transport, parser, mock LTMS server, controlled booking, ledger, real capability, or `LOAD_BOOK` paths.
- [ ] Checks prove Operations routes do not read raw `process.env`, use `NEXT_PUBLIC_*` for secrets, accept cookie auth for ingestion, accept adapter auth for GETs, or expose either secret.
- [ ] Existing `/api/tms` auth/envelopes/contracts and all Phase 3 tests remain unchanged and green. No TCP/TMS source or test is modified for 4B.
- [ ] Captured output/log checks reject secrets, `MAX_BUY`, `max_rate`, raw logs, raw load data, transcripts, `rawTcp`, stacks, tokens, and arbitrary error text.

## Verification Plan and Post-Phase Gate

This is an automatic technical gate, not a human approval step. A PASS plus the observed 4B implementation commit/hash from this run is required before the executor may continue automatically to 4C. The earlier planning/spec commit does not satisfy this gate.

Run repository-local checks only; none may contact a real TMS or execute a real booking:

- [ ] Focused Operations tests, including ingestion auth, UI/dashboard auth, cookie, DTO/sanitizer, duplicate conflict, list/detail/summary, mode, source/request-ID, leakage, and no-TMS reachability tests.
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Review unexpected changed files: only the exact 4B allowlist may change: `src/operations/config.ts`, `src/operations/api-contract.ts`, `src/operations/operations-auth.ts`, `src/operations/session-helper.ts`, `src/operations/operations-dto.ts`, `src/operations/response-mapper.ts`, `app/api/operations/calls/route.ts`, `app/api/operations/calls/[callId]/route.ts`, `app/api/operations/summary/route.ts`, required login/logout route files, the minimal `app/operations/page.tsx` session guard, and `tests/operations/api/**`; no `/api/tms`, TCP, TMS, mock-server, unrelated UI, or other config files may change.
- [ ] Perform a security review of env reads, imports, cookies, headers, public JSON, logs, sanitizer/store reachability, and protected-data leakage.
- [ ] Confirm no real TMS, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, real runner, credential, or provider call was executed.
- [ ] After all checks PASS, create the separate 4B implementation commit: `feat(operations): add protected operations APIs`, and report its actual phase hash separately from the planning/spec commit hash.
- [ ] A missing or unverified hash is a reporting gap and blocks automatic continuation; it is not permission to proceed.

The post-phase gate passes only when the relevant tests, typecheck, lint, build, `git diff --check`, unexpected-file review, and security review pass. Any protected-data leak, sanitizer bypass, secret exposure, auth substitution, unexpected file, TMS/TCP dependency, or real-booking reachability is a blocker: stop, report it, do not create the 4B commit, and do not advance to 4C. This technical stop does not require human intervention.

## Acceptance Criteria

- [ ] Phase 4B inherits a clean baseline containing the single prior planning/spec commit for all five Phase 4 specs; its hash is distinct from the 4A/4B phase hashes and is not an inter-phase commit.
- [ ] All four mandatory routes exist with stable bounded JSON contracts and no UI/TCP/TMS changes.
- [ ] Ingestion accepts only the adapter header backed by server-only `ADAPTER_SHARED_SECRET`; a UI cookie cannot substitute, and the secret never leaks.
- [ ] Ingestion uses the Phase 4A sanitizer as its sole data boundary, accepts the exact handoff raw DTO/uppercase enums, silently drops unknown/forbidden fields, derives canonical statuses/load summaries, and stores no raw load/log/transcript/TCP data.
- [ ] `callId` is generated when omitted, `requestId` is separately generated/propagated, and successful ingestion responds exactly with `{ok:true,data:{callId,stored:true},meta:{requestId,source:"adapter-fallback"}}`.
- [ ] Duplicate call IDs follow the Phase 4A conflict contract: every duplicate, including identical canonical input, returns safe `409 DUPLICATE_CALL_ID`; nothing duplicates or overwrites.
- [ ] GET list/detail/summary and `/operations` require the separate UI session; adapter auth alone does not authorize reads, and unauthorized page requests redirect safely to login.
- [ ] Session cookies are signed/HMAC, expiring, HTTP-only, `SameSite=Lax`, `Path=/`, `Secure` in production, bounded in lifetime, and contain no raw secret. Login/logout do not expose or log either secret.
- [ ] List filtering, default/max limits, date bounds, and deterministic ordering are enforced locally over sanitized records. No GET calls TMS or TCP.
- [ ] Detail returns one sanitized record or safe not-found; enrichment is limited to `origin`, `destination`, `equipment`, and `publishedRate` and never accepts raw load/log data.
- [ ] Summary returns the seven required fields plus `fmcsaVerificationRate`, with canonical counts/formulas and no secrets, `MAX_BUY`, internal pricing, raw logs, transcripts, or TCP data.
- [ ] Every response uses no-store/security headers, bounded request IDs, `source:"adapter-fallback"`, stable safe errors, and no sensitive reflection.
- [ ] Routes are thin and modules remain separated into contract, auth, session, DTO/sanitizer boundary, response mapping, and store responsibilities; no domain duplication or raw env in routes exists.
- [ ] Focused tests plus `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, unexpected-file review, security review, and no-real-TMS verification pass.
- [ ] The separate 4B commit is `feat(operations): add protected operations APIs`, its actual phase hash/state is reported separately from the prior planning/spec hash, and no next phase begins while any security/protected-data/real-reachability blocker remains; continuation depends only on the automatic gate PASS and same-run phase hash, not manual approval.

## Risks / Safety / Rollback

- **Secret confusion:** Keep `ADAPTER_SHARED_SECRET` and `OPERATIONS_UI_SECRET` separate in names, providers, comparisons, and tests. Never fall back between them or expose either to browser code.
- **Sanitizer bypass:** Require the 4A sanitizer before DTO parsing/store access. If 4A cannot safely classify a field, stop rather than adding an ad hoc route sanitizer.
- **Operational-data leakage:** Construct list/detail/summary responses field-by-field, bound notes/reasons/enrichment, and test captured logs and JSON for forbidden data.
- **Duplicate overwrite:** Delegate to 4A duplicate-conflict behavior; every supplied duplicate `callId` is `DUPLICATE_CALL_ID`, including identical replay. Never implement last-write-wins, upsert, overwrite, or idempotency.
- **Cache/session confusion:** Set no-store/security headers on every response, vary protected responses on cookies, verify expiry/signature, and use a fixed login redirect.
- **TMS scope creep:** Keep all reads local to the sanitized store and static-test import/reachability boundaries. Any proposed TMS/TCP or real-booking dependency is `BLOCKED`.

Rollback is limited to the 4B Operations route/auth/spec implementation. Preserve Phase 4A and all Phase 3 `/api/tms` contracts and tests. If auth, sanitizer, or mapping is unsafe, fail closed or remove the affected Operations route; do not add a weaker fallback, accept a UI cookie for ingestion, expose raw diagnostics, or alter TCP/TMS behavior.

## Handoff to `@coder-heavy`

The executor receives a clean baseline whose prior/base commit already contains the single planning commit for all five Phase 4 specs. That planning/spec hash is recorded separately and is not a 4B or inter-phase commit; only the observed 4A phase hash gates entry to 4B.

Implement Phase 4B as the second stage of the single autonomous Phase 4 run, only after the 4A automatic gate PASS and observed 4A phase commit/hash. `@coder-heavy` may change only `src/operations/config.ts`, `src/operations/api-contract.ts`, `src/operations/operations-auth.ts`, `src/operations/session-helper.ts`, `src/operations/operations-dto.ts`, `src/operations/response-mapper.ts`, `app/api/operations/calls/route.ts`, `app/api/operations/calls/[callId]/route.ts`, `app/api/operations/summary/route.ts`, login/logout route files only if required, the minimal `app/operations/page.tsx` session guard if required, and `tests/operations/api/**`. Do not implement new UI, TCP/TMS changes, real TMS access, `LOAD_QUERY`, `LOAD_GET`, `LOAD_BOOK`, or any real booking path; do not skip or reorder phases. Preserve Phase 4A and Phase 3 contracts. The planner performs only the initial handoff and does not implement product code or approve between phases. After this post-phase gate PASS, create the separate 4B implementation commit and record its actual phase hash, then continue automatically with 4C in the same run. Stop and report immediately on protected-data leakage, secret exposure, sanitizer bypass, auth substitution, unexpected-file drift, an unverifiable requirement, or any real TMS/booking reachability; do not create the failed-phase commit or advance.
