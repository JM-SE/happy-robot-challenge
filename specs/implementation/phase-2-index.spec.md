# Phase 2 — Real TMS Validation Phase Index Specification

## Context

Phase 2 validates the adapter progressively against the challenge TMS using the official handbook (`HR-LTMS-PR-001`) plus sanitized observed evidence. The mock remains a local regression aid, not protocol authority.

Today's challenge closure scope is the TMS workflow only. HappyRobot/voice UI, FMCSA integration implementation, and the conversational negotiation engine remain outside Phase 2; Phase 2C records typed preconditions for their outputs where booking depends on them.

No real booking has been successfully verified. Phase 2C execution remains gated, `rollbackAvailable=false`, and its authoritative corrected specification is `specs/implementation/phase-2c-real-controlled-booking.spec.md`; the remediation plan is `specs/implementation/phase-2-security-gates-remediation.spec.md`. Phase 2C remains blocked before real booking.

The previous 2C static-fixture design is superseded: its static handbook ID returned deterministic `NOT_FOUND` and did not model the operational workflow. The existing failed/preflight report is not successful booking proof and must retain that provenance.

## Requirements

### Phase routing

| Phase | Scope | Output gate | Status |
| --- | --- | --- | --- |
| **2A** | Authorized real `DEBUG_ECHO` only | Sanitized successful echo evidence; no operational command capability | **IMPLEMENTED — REAL DEBUG_ECHO VERIFIED** |
| **2B** | Real read-only `LOAD_QUERY` and `LOAD_GET` | Verified query/detail behavior and ability to supply a valid **current query-derived candidate identity** to the separate 2C workflow; no booking capability | **IMPLEMENTED — REAL READ-ONLY LOADS VERIFIED** |
| **2C** | Current query → explicit selection → detail → validated external handoffs → one-shot real booking | Separately approved single attempt, exact ID continuity, sanitized evidence, deterministic/uncertainty classification, and explicit acceptance of no rollback | **IMPLEMENTED LOCALLY — REVISION REQUIRED BEFORE REAL BOOKING** |

### Cross-phase gates

- [x] 2A remains closed and verified; it does not authorize operational commands.
- [x] 2B remains closed and verified read-only. Its validated query/detail capability supplies the semantics needed for a current candidate identity, but its runner/capability never books.
- [x] 2C must obtain identity from its own approved current `LOAD_QUERY` state-machine step, explicitly select exactly one returned candidate, and retain the ID only in memory. It does not depend on a static fixture or persisted ID from 2B evidence.
- [x] 2C includes `LOAD_QUERY`, one selected `LOAD_GET`, zero/one `LOAD_BOOK`, and optional one reconciliation `LOAD_GET` only after genuine post-write uncertainty. This is a dedicated capability, not a broad reusable allowlist.
- [x] A selected load is bound to externally completed negotiation output and externally FMCSA-validated carrier proof before booking. Full negotiation, FMCSA integration, HappyRobot, and voice implementation remain outside Phase 2.
- [x] Public routes and default/generic clients remain denied before real connection/write; 2A, 2B, `npm test`, and CI remain isolated from the 2C runner.
- [x] No real execution occurs without server-only guards, candidate non-production target, all 2C safety gates, a separate immediate explicit approval, and explicit acceptance of `rollbackAvailable=false`.

## Technical Approach

### Phase boundaries

- **2A:** retain its echo-only capability and sanitized evidence unchanged.
- **2B:** retain verified read-only query/detail behavior. Query responses may contain zero/many candidates; a valid current query-derived candidate can enter 2C only through 2C's explicit selection/context contract, never through report persistence or implicit first-result selection.
- **2C:** follow the corrected authoritative sequence: approved current `LOAD_QUERY` → zero/many candidates → explicit selection of one returned load → same in-memory ID → one immediate `LOAD_GET` → externally accepted negotiation result → externally FMCSA-validated MC handoff → one-shot `LOAD_BOOK` with the same ID.

### Phase 2C typed preconditions

- **Selection context:** query/run identity plus exactly one returned ID, explicit confirmation, and freshness deadline.
- **Negotiation result:** same selected ID/session, agreed rate, explicit final acceptance, and boundary evidence for no more than three counteroffers; no inference from internal pricing and no requirement that agreed rate equal posted `RATE`.
- **Carrier validation:** normalized MC, `validated=true`, validation timestamp/reference when available, and carrier/session binding. Formatting alone is insufficient.
- **One-shot authorization:** immutable bindings for query/run, selected ID, carrier proof, agreed rate, TTL, and atomically consumed single booking-attempt budget.

### Shared protocol and evidence constraints

- Query wire fields remain documented origin/destination city/state/ZIP/equipment/`maxResults`; do not infer a pickup-date request field.
- Public/operational load data requires identity/route/equipment/`RATE` and may expose evidence-supported `pickupDate`, `miles`, and `status`. `MAX_BUY` is optional internal-only and never exposed or persisted.
- Deterministic structured remote errors terminate the attempt. Only ambiguity after the booking write may be side-effect-uncertain; booking is never retried.
- Reconciliation GET success alone does not prove reconciliation; documented booking-state evidence is required.
- Evidence is sanitized of IDs, filters, MC, rates, transcripts, booking references, raw wire, connection/auth data, internal pricing/free text, and PII.

## Implementation Steps

1. Preserve verified Phase 2A and 2B contracts, runners, capabilities, and evidence.
2. Implement the corrective work only through the authoritative 2C specification; do not create a competing 2C plan.
3. Correct 2C query/load mapping, explicit selection, typed external handoffs, state-machine capability, atomic one-shot authorization, thin runner, outcome classification, and evidence sanitization.
4. Verify locally with normal tests, typecheck, lint, and build; local acceptance performs no real TMS operation.
5. Keep the existing failed static-fixture report as failed/preflight evidence with unambiguous provenance.
6. After all local gates pass, request separate final explicit approval for the dedicated real runner. Approval must cover one attempt and `rollbackAvailable=false`; absence of approval keeps execution blocked.

## Verification Plan

- [x] 2A real echo evidence remains valid and isolated.
- [x] 2B real read-only query/detail evidence remains valid and isolated; 2B is closed/verified.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass after 2C corrections, with real runners excluded.
- [x] Regression proves 2A echo-only and 2B read-only capabilities were not broadened.
- [x] 2C local tests cover exact ID continuity, explicit selection, optional response fields, date-wire denial, private optional `MAX_BUY`, external handoff binding, TTL/drift, atomic one-shot budget, deterministic errors, post-write uncertainty, truthful reconciliation, access denial, and evidence redaction.
- [x] Existing 2C failed/preflight evidence remains distinct and is not overwritten or treated as successful booking proof.
- [x] The dedicated real 2C runner remains disabled until a separate final explicit approval; no real booking is part of local acceptance.

## Acceptance Criteria

- [x] Phase 2A remains **IMPLEMENTED — REAL DEBUG_ECHO VERIFIED**.
- [x] Phase 2B remains **IMPLEMENTED — REAL READ-ONLY LOADS VERIFIED** and supplies validated current query-derived candidate semantics to 2C without granting booking capability.
- [x] Phase 2C no longer depends on a static fixture and instead owns the current-query, explicit-selection, exact-ID workflow defined by its authoritative spec.
- [x] Full app integrations remain outside Phase 2 while their typed negotiation and carrier-validation preconditions are explicit.
- [x] No contradictory claim prohibits all future Phase 2 booking execution: no booking has been successfully verified, and any single real attempt remains separately gated.
- [x] `rollbackAvailable=false` is explicit throughout the 2C gate.
- [ ] Phase 2C remains open with status **IMPLEMENTED LOCALLY — REVISION REQUIRED BEFORE REAL BOOKING** until corrected local acceptance passes and separately approved real evidence proves the workflow.
