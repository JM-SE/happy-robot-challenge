# Phase 2C — Real Controlled Booking Specification

## Context

- **Status:** **IMPLEMENTED LOCALLY — REVISION REQUIRED BEFORE REAL BOOKING**. No real booking has been successfully verified; Phase 2C is not closed.
- **Scope:** close today's challenge only for the TMS workflow. HappyRobot/voice UI, FMCSA integration implementation, and the conversational negotiation engine are outside this phase.
- Phase 2A is verified for `DEBUG_ECHO`; Phase 2B is verified read-only for `LOAD_QUERY` and `LOAD_GET` against candidate non-production.
- This specification supersedes the previous static-fixture design. The static handbook ID returned deterministic `NOT_FOUND` and does not model the operational workflow; that dead fixture and its associated values must not be required, used, logged, or persisted.
- The authoritative workflow derives the booking identity from a current approved query and keeps it only in memory through selection, detail, external handoffs, and booking.
- `rollbackAvailable=false`. No rollback/unbooking behavior is documented.

## Requirements

### Operational sequence and identity continuity

- [ ] Execute exactly: approved current `LOAD_QUERY` → zero/many candidates → explicit selection of exactly one returned load → same in-memory `LOAD_ID` → one `LOAD_GET` → externally completed negotiation result → externally FMCSA-validated carrier handoff → one-shot `LOAD_BOOK` with that exact same ID.
- [ ] Never use an implicit first-result fallback in production. Zero results stop as no candidate; multiple results require an explicit choice of one returned candidate.
- [ ] A dedicated real validation runner may accept a sole result only when the query used `maxResults=1` **and** a separate explicit selection confirmation is supplied. The ID remains in memory and is never printed or persisted.
- [ ] Selection authorizes only the exact selected ID. Abort on substitution, mismatch, drift, ambiguity, or disappearance; never choose another candidate automatically.
- [ ] Phase 2C owns a dedicated state-machine capability containing `LOAD_QUERY`, one selected `LOAD_GET`, and at most one `LOAD_BOOK`; it must not broaden a reusable allowlist or alter the verified 2B read-only capability.

### Query and load contracts

- [ ] The query request supports only the documented existing origin/destination city, state, ZIP, equipment, and `maxResults` fields.
- [ ] Do not add or infer a pickup-date request field or wire format. The handbook mentions pickup date as a concept but does not document such a request field.
- [ ] Map optional response fields `PICKUP_DT`, `MILES`, and `STATUS` to `pickupDate`, `miles`, and `status` without inventing status eligibility enums.
- [ ] The operational/public load contract requires identity, route, equipment, and `RATE`; `pickupDate`, `miles`, and `status` are optional when supported by response evidence.
- [ ] `MAX_BUY` is optional and internal-only. Its absence must not fail query or detail, and it must never be exposed, logged, or persisted.
- [ ] Optional application-side date filtering may inspect only returned records. It must document possible false negatives caused by server `maxResults`/ceiling, define fail-closed handling for missing or unparseable dates, and never claim complete date discovery.

### Negotiation and carrier validation handoffs

- [ ] Treat `RATE` as the posted, negotiable rate. The challenge permits an initial offer and at most three counteroffers; internal limits must never be revealed.
- [ ] The exact server validation formula for `AGREED_RATE` is undocumented. Do not infer it from `MAX_BUY`, require `AGREED_RATE === RATE`, or use `LOAD_BOOK` as a rate probe.
- [ ] Accept a typed externally completed negotiation result containing the exact selected ID, agreed rate, explicit final acceptance, session/run binding, and boundary evidence that the maximum-three-counteroffers contract was respected.
- [ ] The carrier supplies an MC during the call. FMCSA integration implementation is out of scope, but booking requires a typed external validation handoff containing normalized MC, `validated=true`, validation timestamp, reference when available, and carrier/session binding.
- [ ] Fail closed when carrier proof is absent, stale, malformed, unvalidated, or mismatched. Generic string formatting is not FMCSA proof.

### State machine, freshness, and one-shot authorization

- [ ] Enforce: `ready → queried → selected → detailed → handoffs-validated → booking-consumed → terminal`, with optional `uncertain → reconciliation-consumed → terminal` only after genuine post-write transport uncertainty.
- [ ] Create an immutable consumable capability bound to query/run identity, exact selected ID, validated MC identity/proof, agreed rate, freshness deadline, and one booking-attempt budget.
- [ ] Consume the booking budget atomically **before** the write. No outcome, including deterministic failure or uncertainty, restores it.
- [ ] Apply a named bounded TTL. Perform detail immediately before booking, require exact ID continuity, inspect documented `STATUS` when present without inventing an eligibility enum, and abort on stale context or material drift.
- [ ] Permit at most one reconciliation `LOAD_GET`, only after timeout/EOF/protocol/connection ambiguity occurring after the booking write may have been transmitted. Never retry `LOAD_BOOK`.

### Outcomes, isolation, and evidence

- [ ] A successful `LOAD_BOOK` requires the documented success contract and booking reference, but the reference must remain secret from evidence/logs.
- [ ] `ALREADY_BOOKED`, `INVALID_RATE`, `UNKNOWN_LOAD`, authentication failures, and other structured remote errors are deterministic and terminal. `INVALID_RATE` is never retried.
- [ ] Pre-write failures are deterministic no-side-effect failures. Only post-write timeout/EOF/protocol/connection ambiguity can be `side-effect-uncertain`.
- [ ] A successful reconciliation GET is not automatically `reconciled`; require documented booking-state evidence. Otherwise classify `still-uncertain`.
- [ ] No public route may obtain real-booking capability. Existing routes reject before connection. Only the dedicated server-only runner/orchestrator can receive it; 2A, 2B, `npm test`, CI, and generic clients remain unable to book.
- [ ] Evidence records only stages (`query`, `selection`, `detail`, `booking`, optional `reconciliation`), counts, durations, allowlisted field names, terminal/lifecycle data, deterministic-versus-uncertainty classification, and attempt-budget state.
- [ ] Never record IDs, filters, MC, rates, negotiation transcript, booking reference, raw wire, token, host/port, `MAX_BUY`, `NOTES`, or PII.
- [ ] Preserve the existing Phase 2C report as failed/preflight evidence from the superseded static fixture. Do not overwrite or relabel it as successful booking proof; any future authorized run requires distinct provenance and an unambiguous artifact.
- [ ] Every outcome declares `rollbackAvailable=false`.

## Technical Approach

### Maintainable decomposition

- **Query input/response mapper:** allowlists documented query fields, denies date on wire, maps zero/many records and optional `PICKUP_DT`/`MILES`/`STATUS`.
- **Operational load type:** exposes required identity/route/equipment/`RATE` plus evidence-supported optional fields; keeps `MAX_BUY` private and optional.
- **Explicit selection/context type:** binds query/run identity and exactly one returned ID without implicit fallback or persistence.
- **Negotiation result handoff:** validates selected-ID/session binding, agreed rate, final acceptance, and the max-three-counteroffers boundary contract; it does not implement conversation logic.
- **Validated carrier handoff:** validates normalized MC, FMCSA validation proof/freshness, and carrier/session binding; it does not implement FMCSA access.
- **State-machine/one-shot authorization:** owns legal transitions, TTL/drift checks, immutable bindings, atomic booking-budget consumption, and optional reconciliation budget.
- **Thin real runner/orchestrator:** sequences focused modules and IO; it does not parse protocol, implement negotiation/FMCSA, or sanitize ad hoc.
- **Evidence sanitizer:** accepts bounded stage metadata only and prevents sensitive values from entering logs/reports.
- **Existing client/transport/parser:** remain focused on one request per connection, framing/parsing, lifecycle, and typed outcomes; they do not select loads, grant capabilities, or decide reconciliation truth.

### Current corrective impacts

- The current public mapper drops `PICKUP_DT`, `MILES`, and `STATUS`; extend the supported optional contract.
- The current internal mapper requires `MAX_BUY`; make it optional and prevent absence from failing query/detail.
- The current runner uses the dead static fixture and unjustified `RATE === AGREED_RATE`; replace both with query-derived identity and typed external negotiation acceptance.
- The current 2C policy omits `LOAD_QUERY` and exposes a reusable capability; replace it with a dedicated state-machine capability and consumable one-shot authorization.
- Correct deterministic remote failure versus post-write uncertainty and reconciliation classification.
- Preserve the existing Phase 2C report's failed/preflight provenance; it is not successful booking evidence.

### Workflow

1. Validate server-only real-mode guards, candidate non-production target, dedicated capability, fresh external handoffs, and separate final approval before any connection.
2. Issue one approved query using only documented fields and map zero/many candidates.
3. Obtain explicit selection of exactly one returned candidate; retain its ID only in memory and bind the selection to the query/run.
4. Accept and validate the externally completed negotiation and FMCSA carrier handoffs against the selected ID/session.
5. Immediately before booking, issue exactly one detail request for the selected ID and validate TTL, exact identity, documented fields/status, and material drift.
6. Mint/finalize the immutable authorization, atomically consume its sole booking budget, and issue at most one booking write with the selected ID, validated normalized MC, and externally agreed rate.
7. Classify the response deterministically. Only genuine post-write transport ambiguity may consume one reconciliation detail; require documented booking-state evidence to call it reconciled.
8. Produce sanitized evidence with distinct provenance. Never retry, substitute an ID, or perform rollback.

## Implementation Steps

1. Correct query/load mappers and contracts for documented request fields, optional response fields, and optional internal-only `MAX_BUY`.
2. Add focused selection context, negotiation result, and validated carrier handoff types with strict identity/session/freshness validation.
3. Replace broad 2C policy access with the dedicated state machine and atomically consumable one-shot authorization.
4. Refactor the real runner into a thin orchestrator using a current query-derived identity and explicit selection; remove dependency on the dead fixture and rate-equality assumption.
5. Correct client-to-orchestrator outcome classification and bounded reconciliation semantics while preserving client/transport/parser responsibilities.
6. Harden evidence sanitization and preserve failed/preflight report provenance.
7. Add local tests and run local verification only. Do not perform a real query, detail, booking, reconciliation, report rewrite, or other TMS operation during implementation/acceptance.
8. Keep real execution blocked until a separate, immediate, explicit approval authorizes the dedicated runner's single attempt with `rollbackAvailable=false` accepted.

## Verification Plan

Local-only commands:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Required local tests:

- [x] Exact ID continuity and rejection of ID substitution.
- [x] Zero/multiple result handling, no implicit selection, and sole-result confirmation constraints.
- [x] Pickup/date field denied on wire; optional response field mapping and bounded application-side date-filter semantics.
- [x] `MAX_BUY` absent without failure and redacted when present.
- [x] TTL expiry, detail drift/ambiguity, exact-ID mismatch, and no candidate substitution.
- [x] FMCSA proof absence/staleness/mismatch and negotiation selected-ID/session/final-acceptance binding, including maximum-three-counteroffers boundary validation.
- [x] Atomic one-shot budget under repeated/concurrent calls; budget remains consumed for every post-consumption outcome.
- [x] Deterministic structured errors, especially terminal/no-retry `INVALID_RATE`.
- [x] Pre-write failure versus post-write uncertainty; zero booking retries and at most one reconciliation detail.
- [x] Reconciliation requires documented booking-state evidence rather than GET success alone.
- [x] Public route, generic client, 2A, 2B, normal test, and CI denial before connection/write.
- [x] Evidence redaction and preservation of existing failed/preflight provenance.
- [x] Phase 2A/2B regressions remain green and 2B remains read-only.
- [x] Local acceptance performs no real booking and does not mark 2C closed.

The dedicated real runner is not a local verification command. It requires a separate final explicit approval immediately before execution.

## Acceptance Criteria

- [x] The local operational workflow begins with one current approved query and carries one explicitly selected in-memory ID unchanged through detail and the one-shot booking.
- [x] No static handbook fixture, implicit first-result fallback in the workflow, inferred date request field, `MAX_BUY` rate inference, or `RATE === AGREED_RATE` rule remains.
- [x] Query/public contracts and optional fields match documented evidence while internal pricing remains optional, private, and redacted.
- [x] Typed negotiation and FMCSA validation handoffs fail closed and bind to the selected load and carrier/session.
- [x] The dedicated workflow authorization enforces legal state transitions, bounded freshness, exact identity, atomic one-attempt consumption, deterministic outcomes, and bounded truthful reconciliation.
- [x] Public routes and default/generic clients remain denied before real connection/write; 2A/2B and normal tests remain isolated from real booking capability.
- [x] Evidence is sanitized, lifecycle/attempt-aware, and preserves the failed/preflight provenance of the prior report.
- [x] `rollbackAvailable=false` is explicit and separately required before any real execution.
- [x] Local commands and tests pass without any real TMS operation.
- [ ] Status remains **IMPLEMENTED LOCALLY — REVISION REQUIRED BEFORE REAL BOOKING** until a separately approved real workflow produces valid sanitized success evidence. No successful real booking is currently verified, and 2C remains open.
