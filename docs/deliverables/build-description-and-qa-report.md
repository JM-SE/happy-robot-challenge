# Build Description and QA Report

## 1. Executive summary

This repository contains a Next.js HTTP adapter for a carrier-sales workflow.
The evidenced local path is a deterministic TMS mock behind authenticated,
validated HTTP routes. A guarded, server-only `node:net` TCP path exists for
read-only TMS operations, but real endpoint behavior is
**IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**. Real TMS connectivity and
real booking are not evidenced.

The product shape is a HappyRobot App (deployed/complete and connected;
limitations apply) using an authenticated HTTP handoff to the Railway-hosted
adapter. The HappyRobot App deployment/completion, adapter connection, and
Railway deployment are user-confirmed. External
smoke evidence is not recorded, so this does not verify every external
dependency or end-to-end business capability, including OTP delivery, FMCSA
validation, Twin availability, real TMS behavior, or real booking.

Local mock behavior is **VERIFIED — LOCAL MOCK**. Public real booking is
disabled and fails closed before TMS access. This report consolidates the
build description, contract boundaries, limitations, and supplied QA evidence;
it does not add implementation or claim external success.

## 2. Business problem

Carrier-sales staff need a controlled workflow to find loads, retrieve a
selected load, verify carrier information, negotiate a rate, and hand off an
explicit booking decision. The adapter supplies a narrow boundary for the
load-search/detail/booking-shaped interactions while keeping wire credentials,
private data, and booking controls server-side.

## 3. Solution scope

### Included

- Next.js route handlers on the Node runtime because TCP uses `node:net`.
- Authenticated JSON HTTP adapter routes for echo, load search, detail, and
  booking-shaped behavior.
- Local deterministic mock behavior and local mock fault scenarios.
- Guarded server-only TCP client with CRLF framing and one socket per request.
- Safe public mapping, request IDs, sanitized response envelopes, and a
  fail-closed real-booking guard.
- Temporary process-local Operations UI projection.

### Not included or not externally enabled

- FMCSA provider validation: **OUT OF SCOPE**.
- Automated negotiation engine: **OUT OF SCOPE**.
- Web Call and Inbound Voice Agent behavior: **IMPLEMENTED — NOT CURRENTLY VERIFIED**; the App and adapter connection are user-confirmed, but provider/dependency smoke evidence is absent.
- Real booking/real `LOAD_BOOK`: **NOT IMPLEMENTED**.
- OTP SMS/email delivery: **BLOCKED — ORGANIZATION/ENVIRONMENT**.
- Twin/data layer: **BLOCKED — ORGANIZATION/ENVIRONMENT** because the
  organization DB quota was exceeded.
- TLS transport: **OUT OF SCOPE** for this build.
- Durable operational storage and real-booking rollback/reconciliation:
  **OUT OF SCOPE**.

## 4. End-to-end workflow

1. The implemented and connected HappyRobot App gathers carrier, load, offer,
   and handoff information; external voice execution is not evidenced.
2. An authenticated HTTP handoff maps fields to the adapter. Any remaining
   contract or field mapping questions are **IMPLEMENTED — CURRENTLY UNDER
   INVESTIGATION**.
3. The adapter checks method, JSON content type, authentication, exact request
   shape, bounds, and unsupported fields, then assigns a request ID.
4. The adapter selects local deterministic mock mode or guarded server-only
   read-only TCP mode.
5. Search returns mapped public load fields; detail returns a mapped selected
   load. Private notes, raw wire data, tokens, and internal purchase policy
   details remain excluded.
6. A controlled negotiation workflow may collect explicit offers and final
   acceptance, with at most three counteroffer rounds in the code/spec
   context. External voice execution is not claimed.
7. Mock booking returns a deterministic demo result locally. Real mode rejects
   booking with HTTP 403 `REAL_BOOKING_DISABLED` before TMS access.
8. The connected App's call-record handoff may feed the temporary in-memory
   Operations projection after its contract is approved and smoke-tested;
   external handoff execution remains unrecorded.

## 5. Architecture/component responsibilities

| Component | Responsibility | Status |
|---|---|---|
| HappyRobot App | Implemented voice/call workflow and handoff inputs | IMPLEMENTED — NOT CURRENTLY VERIFIED |
| HTTP adapter | Auth, validation, request IDs, safe mapping, errors, guards | VERIFIED — LOCAL MOCK |
| TMS mock | Deterministic local echo/search/detail/booking behavior | VERIFIED — LOCAL MOCK |
| TCP client | Server-only byte-stream transport and command framing | IMPLEMENTED — CURRENTLY UNDER INVESTIGATION for real endpoint use |
| Operations UI | Temporary process-local in-memory projection, with fallback/demo data | IMPLEMENTED — NOT CURRENTLY VERIFIED |
| Twin | Shared/operational data layer | BLOCKED — ORGANIZATION/ENVIRONMENT |

## 6. HappyRobot workflow design

The design is HappyRobot voice/call orchestration followed by an authenticated
HTTP handoff to the adapter. The HappyRobot App is complete and connected by
user confirmation. Handoff/mapping details remain **IMPLEMENTED — CURRENTLY
UNDER INVESTIGATION** where the contract is still being clarified; successful
external call execution is not evidenced.

Web Call and Inbound Voice Agent behavior are **IMPLEMENTED — NOT CURRENTLY
VERIFIED**. The HappyRobot App is complete and connected by user confirmation.
External provider/dependency smoke evidence and full business-capability
evidence remain unrecorded; the adapter must not be treated as proof that every
provider dependency, call-record webhook, or voice transfer occurred.

## 7. FMCSA validation

FMCSA validation is **OUT OF SCOPE**. No live provider, consent flow, carrier
result, or FMCSA smoke test is claimed. A recent FMCSA proof concept is a
planned booking safety concept only, not an available verification result.

## 8. OTP flow and organization limitation

SMS/email OTP delivery and verification are **BLOCKED —
ORGANIZATION/ENVIRONMENT** because the capability is unavailable in the
HappyRobot organization. No OTP delivery test was run and no OTP compliance
decision is claimed.

## 9. TMS protocol/adapter design

The TMS transport is a TCP byte stream. Messages use CRLF framing and complete
with terminal `END` plus peer close. Each request uses one socket. Commands are
`DEBUG_ECHO`, `LOAD_QUERY`, `LOAD_GET`, and `LOAD_BOOK`. Authentication and
wire payloads are server-only. TLS is not implemented.

The public adapter adds JSON content-type enforcement, the server-only
`ADAPTER_SHARED_SECRET` in `x-adapter-api-key`, exact DTO validation, request
IDs in the response metadata and `x-request-id`, and sanitized error envelopes.

## 10. LOAD_QUERY, LOAD_GET, LOAD_BOOK contracts

The complete contract is in [docs/api-contract.md](../api-contract.md).

### `POST /api/tms/loads/search` (`LOAD_QUERY`)

The only accepted request keys are `originState`, `destinationState`,
`equipmentType`, and `maxResults`. At least one of the first three filters is
required. `maxResults` defaults to 10 and is bounded from 1 through 50. States
and equipment are normalized. City and ZIP are not accepted by this HTTP
contract.

### `POST /api/tms/loads/detail` (`LOAD_GET`)

The body is exactly `{ "loadId": "..." }`; the ID is bounded to 64 characters
and cannot contain framing characters. A local unknown ID maps to HTTP 404
`LOAD_NOT_FOUND`.

### `POST /api/tms/loads/book` (`LOAD_BOOK`)

The body is exactly `{ "loadId": "...", "mc": "...", "agreedRate": ... }`.
`mcNumber` is rejected; `mc` is authoritative. `agreedRate` must be finite,
positive, no more than two decimal places, and no greater than 1,000,000.

Mock booking returns a deterministic demo result without TCP. Local domain
errors include HTTP 404 `LOAD_NOT_FOUND`, 409 `BOOKING_CONFLICT`, and 422
`RATE_NOT_ACCEPTED`. In real mode, booking fails closed with HTTP 403
`REAL_BOOKING_DISABLED` before TMS access.

`GET /api/health` is unauthenticated and performs no external I/O; it returns
`{ "status": "ok" }` as a liveness result only.

## 11. Negotiation rules (maximum 3 counteroffer rounds)

Automated negotiation is **OUT OF SCOPE**. The controlled workflow described by
the code/spec context supports explicit final acceptance and a maximum of
three counteroffer rounds. It does not establish that a voice agent executed
those rounds externally, nor does it claim an autonomous negotiation engine.

The final accepted load must remain bound to the selected load, and the final
agreed rate must pass public validation. Any authority, provider, or external
approval policy remains to be defined and approved.

## 12. MAX_BUY/MAX_RATE confidentiality

`MAX_BUY` is an internal purchase ceiling. Its value and decision details must
never be documented as public data, returned, logged, or exposed to a caller.
The public HTTP validation ceiling is `MAX_RATE = 1,000,000` for `agreedRate`.
These are distinct: this report does not reveal or infer the internal
purchase-ceiling value.

## 13. Booking safety gates/status

The controlled workflow concept includes selected-load binding, explicit final
confirmation, a recent FMCSA proof concept, one-shot/ledger protection, and no
automatic retry. These controls do not constitute external booking evidence.

Mock booking is **VERIFIED — LOCAL MOCK**. Public real booking is
**NOT IMPLEMENTED**: real mode returns `REAL_BOOKING_DISABLED` before TMS
access, real `LOAD_BOOK` was never executed, and no approved real `LOAD_ID`
exists. No real-booking rollback or reconciliation procedure is available.

## 14. Senior representative handoff

Senior representative handoff is a planned/provisional HappyRobot and
Operations handoff with conceptual fields such as selected load reference,
carrier/contact context, negotiation outcome, confirmation state, and next
action. No successful external handoff is evidenced. Do not place secrets,
full MC values, raw transcripts, private notes, or internal pricing policy in
the handoff payload.

## 15. Operational UI

The Operations UI is a temporary process-local in-memory projection and may
display fallback/demo data. It is **IMPLEMENTED — NOT CURRENTLY VERIFIED** as
an externally integrated operational surface. It is non-persistent and is not
evidence of HappyRobot, TMS, or Twin connectivity.

## 16. Twin/data layer

Twin is **BLOCKED — ORGANIZATION/ENVIRONMENT** because the organization DB
quota was exceeded. Twin availability, synchronization, and any Twin-backed
operational result are therefore not claimed.

## 17. Auth/security

- TMS routes require `POST`, JSON content type, and `x-adapter-api-key` matching
  server-only `ADAPTER_SHARED_SECRET`.
- Validation is exact and closed; unsupported fields are rejected.
- Request IDs support correlation; errors use sanitized public envelopes.
- No `NEXT_PUBLIC_*` secret is used.
- Tokens, wire payloads, private notes, full MC values, raw transcripts,
  internal pricing, and purchase-ceiling values/details are excluded from
  public data and logs.
- Health is unauthenticated liveness only; it does not prove dependency
  readiness.
- Security checks and booking zero-reachability checks are part of the supplied
  evidence, not tests rerun for this report.

## 18. Deployment model

The intended deployment is one Railway service using the multi-stage
`node:22-alpine` Dockerfile. It runs `npm ci`, `npm run build`, production
`npm ci --omit=dev`, and the direct Next command. Railway supplies dynamic
`PORT` with a fallback of 3000. `railway.json` uses `/api/health`, a 10-second
timeout, and restart-on-failure with a maximum of three retries.

Railway deployed? **YES, by user confirmation.** No public URL is recorded in
this documentation. Railway is used as a hosting workaround because
HappyRobot infrastructure could not host the app. External Railway smoke
tests were not run or are not evidenced.

## 19. Health/readiness

`GET /api/health` is unauthenticated liveness and returns exactly
`{ "status": "ok" }` with no external I/O. It does not establish TMS,
HappyRobot, or Railway readiness. An internal readiness evaluator exists, but
there is no public readiness endpoint.

## 20. Configuration/secrets

Configuration is server-only and supplied through environment variables. The
repository context identifies TMS connection/authentication settings,
adapter mode and shared secret, mock scenario controls, real read-only
approved controls, and the real-booking disable flag. Values, tokens, URLs,
and secrets are intentionally omitted here. No secret belongs in source,
`NEXT_PUBLIC_*`, URLs, logs, reports, or webhook payloads.

## 21. Failure handling

The adapter maps invalid method/content type/body, unauthorized callers,
oversized requests, unavailable configuration, TMS authentication/upstream/
protocol/timeout failures, local not-found/conflict/rate errors, and disabled
booking to stable sanitized statuses/codes. Raw upstream details are not
returned. The controlled workflow has no automatic booking retry. There is no
real-booking rollback/reconciliation procedure.

## 22. Northstar KPIs (proposed/defined, not measured)

The following are proposed/defined measurement targets, not repository or
external results:

- Search-to-qualified-load completion rate.
- Detail retrieval success rate by mode.
- Explicit final-confirmation rate before booking handoff.
- Counteroffer rounds per accepted negotiation, capped at three.
- Booking guard rejection rate for unauthorized real attempts.
- Handoff completeness and sanitized-record acceptance rate.
- Time from load selection to senior representative handoff.
- TMS timeout, protocol-error, and upstream-error rates.

## 23. Status table

| Area | Category | Status | Evidence/qualification |
|---|---|---|---|
| Local echo/search/detail/booking mock | implemented and verified | VERIFIED — LOCAL MOCK | Supplied local tests and deterministic mock behavior |
| Auth, validation, request IDs, sanitized envelopes | implemented and verified | VERIFIED — LOCAL MOCK | Supplied local security/contract evidence |
| Real read-only `LOAD_QUERY`/`LOAD_GET` | code-ready but not externally enabled | IMPLEMENTED — CURRENTLY UNDER INVESTIGATION | Guarded path/code and local mock-TCP composition tests only; no real execution |
| HappyRobot App connection/handoff | implemented locally only | IMPLEMENTED — NOT CURRENTLY VERIFIED | User-confirmed complete/deployed/connected; provider/dependency smoke evidence not recorded |
| Operations UI projection | implemented locally only | IMPLEMENTED — NOT CURRENTLY VERIFIED | Temporary process-local in-memory projection; fallback/demo data possible |
| Docker/Railway deployment model | implemented locally only | IMPLEMENTED — NOT CURRENTLY VERIFIED | User-confirmed Railway deployment; no external smoke evidence recorded |
| Real `LOAD_BOOK`/public real booking | not implemented | NOT IMPLEMENTED | Guarded HTTP 403; never executed; no real `LOAD_BOOK` evidence |
| Web Call / Inbound Voice Agent | implemented locally only | IMPLEMENTED — NOT CURRENTLY VERIFIED | App and adapter connection are user-confirmed; provider/dependency smoke and full business-capability evidence are not recorded |
| FMCSA validation | not implemented | OUT OF SCOPE | No live provider/result claimed |
| Automated negotiation engine | not implemented | OUT OF SCOPE | Controlled handoff rules only |
| OTP delivery | blocked by HappyRobot or environment limitations | BLOCKED — ORGANIZATION/ENVIRONMENT | Unavailable in HappyRobot organization; OTP is not evidenced |
| Twin | blocked by HappyRobot or environment limitations | BLOCKED — ORGANIZATION/ENVIRONMENT | Organization DB quota exceeded; Twin is not evidenced |
| TLS transport | not implemented | OUT OF SCOPE | Not implemented |
| Real TMS connectivity execution | code-ready but not externally enabled | IMPLEMENTED — CURRENTLY UNDER INVESTIGATION | No confirmed connectivity execution; no evidence of real TMS connectivity |

## 24. Scripted QA scenarios

These are scenario definitions, not claims that they were executed in this
task.

1. In mock mode, call authenticated echo with exact `{message}` and verify a
   200 adapter envelope and request ID.
2. Reject missing/incorrect auth, non-JSON content, GET on TMS routes, and
   unsupported body fields.
3. Search with each allowed filter, default `maxResults`, max 50, missing
   filters, city/ZIP, and max 51.
4. Retrieve a known local mock load and an unknown ID; verify 404 mapping.
5. Book a local mock load with `mc` and a valid rate; verify deterministic demo
   output and no TCP dependency.
6. Reject `mcNumber`, malformed load IDs, invalid rates, and unsupported keys.
7. Exercise local 404, 409, and 422 booking domain errors.
8. In real mode, submit booking and verify HTTP 403
   `REAL_BOOKING_DISABLED` before any TMS access.
9. Verify health returns liveness only, no auth requirement, no external I/O,
   and rejects non-GET methods.
10. Validate fragmented CRLF byte-stream handling, terminal `END`, peer close,
    one socket/request, and sanitized transport errors against a local mock TCP
    server.

## 25. Adversarial QA scenarios

- Send framing characters, oversized values, duplicate/unknown JSON keys, and
  wrong content types.
- Attempt `mcNumber` substitution, negative/NaN/infinite/over-maximum rates,
  and a rate with more than two decimals.
- Attempt unauthorized, retried, or out-of-order booking requests.
- Try to reach real booking with every real-mode control combination; verify
  fail-closed behavior and zero TMS booking reachability.
- Supply malformed TCP frames, missing `END`, premature close, delayed close,
  fragmented data, authentication failure, timeout, and upstream error.
- Confirm responses, logs, and handoffs do not expose secrets, tokens, raw wire
  data, full MC values, private notes, raw transcripts, or internal purchase
  ceiling information.
- Confirm health cannot be interpreted as dependency readiness.
- Confirm fallback/demo Operations UI data is not represented as external
  integration evidence.

## 26. Exact test commands and verified results

The following evidence was supplied by project context and was not rerun for
this documentation task:

| Command/check | Supplied result |
|---|---|
| `npm test` / Vitest | 46 test files; 310 tests passing |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Security checks | Passed |
| Booking zero-reachability checks | Passed |
| Local mock coverage | Exists, including echo/search/detail/booking |

The repository identifies Node 22, TypeScript, Vitest, Next.js 16.2.9, and
React 19.2.7 as the relevant runtime/tooling context.

## 27. Tests not run

Not run/not evidenced: Railway deployment/integration smoke tests, HappyRobot
provider smoke tests, real-TMS probes, real `LOAD_BOOK`, OTP delivery, and Twin
verification. Railway deployment exists by user confirmation; HappyRobot App
completion/connection is user-confirmed. Real TMS connectivity executed? No evidence; it is
**IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**. Real `LOAD_BOOK` executed? No.

Local route-composition tests using a mock TCP server are not real-TMS
evidence. No test result in this report should be read as external provider or
deployment confirmation.

## 28. Known limitations

- No approved real `LOAD_ID` is available.
- Real read-only endpoint behavior remains under investigation.
- Real booking is disabled and no rollback/reconciliation procedure exists.
- HappyRobot App, Web Call, and Inbound Voice Agent are implemented and
  connected by user confirmation; remaining contract/mapping questions,
  provider/dependency smoke evidence, and full business-capability evidence are
  unrecorded.
- FMCSA and OTP dependencies are unavailable/out of scope.
- Twin is blocked by organization DB quota.
- Operations data is in-memory and non-persistent.
- Railway deployment exists by user confirmation, but Railway and Docker
  behavior are not externally smoke-tested/evidenced.
- TLS is not implemented.
- Pickup-date business semantics are unspecified.

## 29. Risks

- Treating local mock results or UI demo data as external success.
- Enabling real booking without approved TMS, authorization, ledger, and
  reconciliation procedures.
- Misbinding a booking to a different load or accepting an unconfirmed rate.
- Leaking secrets, private notes, full MC data, raw transcripts, or internal
  purchase policy through logs or handoffs.
- Interpreting liveness as readiness.
- Assuming provider, Railway, Twin, FMCSA, or OTP availability without a
  recorded smoke test.
- Operating without TLS or durable operational state where those controls are
  required.

## 30. Next steps

1. Approve the provisional HappyRobot handoff contract and run a non-mutating
   smoke test.
2. Obtain approved non-production TMS target controls and a real `LOAD_ID`;
   verify read-only `LOAD_QUERY` and `LOAD_GET` only.
3. Keep real booking disabled until authorization, one-shot/ledger,
   reconciliation, transport, and review controls are approved.
4. Resolve the HappyRobot organization limitations for OTP and Twin.
5. Define FMCSA consent/provider scope and an auditable result contract.
6. Validate the deployed Railway service and run the planned health/auth/
   read-only smoke suite; do not redeploy from scratch.
7. Replace the temporary in-memory projection with an approved durable data
   design before operational reliance.
8. Re-run local and external QA with evidence recorded separately for each
   environment and status label.

## Manual-confirmation checklist for brokerage reviewers

- [ ] Railway deployed? **YES, by user confirmation**; no public URL is recorded
      in these docs. Validate the deployed service and attach smoke evidence.
- [ ] Public URL and TLS contract approved and recorded.
- [ ] Real TMS connectivity executed? Record evidence; current status is
      **IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**.
- [ ] Approved real `LOAD_ID` obtained and read-only probes reviewed.
- [ ] Real `LOAD_BOOK` executed? Current answer is **No**; do not enable it
      without written authorization.
- [ ] Selected-load binding and explicit final confirmation reviewed.
- [ ] Maximum three counteroffer rounds confirmed in the operating procedure.
- [ ] FMCSA provider, consent, and recent-proof policy approved; no current
      result is claimed.
- [ ] OTP delivery available? Current answer is **No**;
      **BLOCKED — ORGANIZATION/ENVIRONMENT**.
- [ ] Twin available? Current answer is **No**;
      **BLOCKED — ORGANIZATION/ENVIRONMENT**.
- [ ] Adapter connected to HappyRobot App? **YES, by user confirmation**.
- [ ] HappyRobot App deployed? **YES/implemented and connected, by user
      confirmation**; provider/dependency smoke evidence is still required.
- [ ] HappyRobot Web Call/Inbound Voice Agent smoke evidence obtained; current
       status remains **IMPLEMENTED — NOT CURRENTLY VERIFIED**.
- [ ] Senior representative handoff fields approved without secrets, full MC,
      raw transcripts, or internal purchase policy.
- [ ] Rollback/reconciliation procedure approved before any real booking.
- [ ] External smoke-test evidence and reviewer sign-off attached to the
      relevant status rows.
