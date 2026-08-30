# Phase 5C — Booking Response Alignment Specification

**Status:** **PLAN READY — PREREQUISITE ONLY; REAL BOOKING REMAINS DISABLED**

## Context

Phase 5C aligns local booking compatibility code with the canonical handbook receipt while preserving the existing real-mode `403 REAL_BOOKING_DISABLED` boundary. It updates focused mapping, outcome classification, local mocks, and local tests only. It does not authorize or execute real `LOAD_BOOK`.

Current evidence: `src/tms/booking.ts` requires response `AGREED_RATE`, `MC_NUM`, `BOOKING_REF`, and `BOOKED_AT`; `src/tms/controlled-booking.ts` compares echoed MC/rate and excludes remote `SERVER_ERROR` from uncertainty; `BookingPublic/BookingInternal` conflate request values with response evidence. `mock/ltms-server.ts` emits the legacy shape.

## Requirements

### Canonical receipt mapper

- [ ] Add one focused pure mapper from exactly one successful LOAD_BOOK record to an internal `BookingReceipt` containing only canonical evidence: `loadId`, `bookingRef`, literal status `BOOKED`, and normalized UTC timestamp.
- [ ] Require non-empty, bounded, framing-safe `LOAD_ID` and `BOOKING_REF`; require exact `STATUS:BOOKED`; require exact 14-digit `TIMESTAMP` in `YYYYMMDDHHmmss` and validate UTC calendar/time components.
- [ ] Normalize `TIMESTAMP` to canonical UTC ISO (`YYYY-MM-DDTHH:mm:ss.000Z`) without locale-dependent parsing. This may populate public `bookedAt` only if the existing HTTP DTO retains that field.
- [ ] Do not require, compare, expose, or claim response evidence for `MC_NUM`, `AGREED_RATE`, or `BOOKED_AT`. A legacy response with `BOOKED_AT` but no canonical `TIMESTAMP` is invalid; legacy aliases never satisfy canonical fields.
- [ ] Unknown extra fields may be ignored as non-evidence after generic parsing, but cannot replace or contradict required canonical fields. Duplicate fields remain a wire error from 5A.
- [ ] Retain load-ID binding between authorized selection/request context and receipt. Wrong receipt load ID is a post-write unknown outcome, not confirmed rejection.

### Type and public-result separation

- [ ] Split canonical TMS response evidence (`BookingReceipt`) from authorized request context (`loadId`, MC, agreed rate) and from the public product DTO.
- [ ] Compose any retained public `agreedRate`/MC-derived field only from already-authorized request context; never state or type it as echoed/confirmed by TMS. Current public `bookingRef`, `loadId`, `bookedAt`, mock mode, and demo label may remain when constructively mapped.
- [ ] Retire/rename `recordToBookingPublic`, `BookingInternal`, and `BookingPublic` only after all callers migrate. Use names that distinguish receipt evidence from composed product output.

### Pure booking outcome classification

- [ ] Introduce a pure classifier for a consumed booking attempt. It has a closed confirmed-rejection allowlist: `INVALID_RATE`, `UNKNOWN_LOAD`, `ALREADY_BOOKED`, and `MISSING_FIELD`.
- [ ] A canonical receipt that fully maps and binds is confirmed success. A listed remote ERR is a definitive confirmed rejection.
- [ ] Post-write `SERVER_ERROR`, any undocumented remote code, timeout, partial response, malformed response, close-before-END, wrong/missing status/ref/timestamp, wrong load binding, or mapper failure is `UNKNOWN`.
- [ ] A local failure proven `writeDisposition:not-sent` remains a not-attempted/local failure and is not mislabeled as remote rejection or unknown committed state.
- [ ] The classifier must use typed error/category/write-disposition inputs, not message text. Remote `MSG` is never public/logged evidence.
- [ ] Never automatically retry `LOAD_BOOK`, including confirmed rejection, `UNKNOWN`, timeout, or `SERVER_ERROR`. No reconciliation is added or treated as authority in this phase.

### Controlled workflow and mock

- [ ] Remove response-echo assertions for MC and agreed rate; retain receipt load-ID binding and existing authorization/ledger consumption boundaries.
- [ ] On canonical success, transition as current local behavior requires and return a product DTO composed from receipt + authorized request context.
- [ ] On confirmed rejection, record/return the existing definitive rejection path. On `UNKNOWN`, mark the consumed attempt unknown/uncertain and never replay it.
- [ ] Update mock LTMS booking success wire to `LOAD_ID`, `BOOKING_REF`, `STATUS:BOOKED`, `TIMESTAMP`, then `END`, while preserving deterministic local booking state and duplicate-booking semantics.
- [ ] Keep request fields `LOAD_ID`, `MC_NUM`, and `AGREED_RATE`; this phase changes the response contract, not the confirmed request.
- [ ] Keep public real booking disabled before client/capability/ledger/socket access. Local mock/test booking is the only exercised write path.

## Files / Modules and Boundaries

| Location | Responsibility | Must not own |
| --- | --- | --- |
| `src/tms/booking.ts` and/or focused `src/tms/booking-receipt.ts` | Request mapping plus isolated canonical receipt mapper. | Socket IO, retry, public auth/policy. |
| Focused `src/tms/booking-outcome.ts` | Pure typed classification and confirmed-rejection allowlist. | Network, ledger mutation, HTTP mapping. |
| `src/tms/controlled-booking.ts` | Orchestrate authorization, one write, receipt binding, ledger transition, and composed result. | Parsing mechanics or invented response echoes. |
| `src/tms/types.ts`, `src/tms/public-contracts.ts` | Separate receipt, request context, and product DTO types. | Raw fields or ambiguous evidence names. |
| `mock/ltms-server.ts`, mock dataset/state | Canonical success wire with unchanged deterministic state semantics. | Real target/credentials. |
| `tests/tms/{booking,controlled-booking,mock-booking,booking.integration,booking-routes}.test.ts` or existing equivalents | Local mapper/classifier/workflow/guard evidence. | `tests/tms/real/**` or real scripts. |

No single module may combine wire IO, receipt normalization, public redaction/composition, and booking policy. The outcome classifier and receipt mapper must be independently unit-testable.

## Implementation Steps

1. Define `BookingReceipt`, composed product result boundaries, exact timestamp parser, and pure receipt tests.
2. Add the pure booking outcome classifier and table-driven tests for every confirmed/unknown/not-sent category.
3. Migrate controlled booking to receipt mapping, load-ID binding, request-context composition, and classifier-directed ledger/state transitions.
4. Remove MC/rate echo checks and migrate/remove misleading old booking functions/types.
5. Update the local mock success frame and deterministic integration expectations; preserve stateful `ALREADY_BOOKED` behavior.
6. Prove the public real booking route still denies before all booking dependencies, then run focused and global local-only gates.

## Test and Acceptance Gate

- [ ] Exactly canonical `LOAD_ID|BOOKING_REF|STATUS:BOOKED|TIMESTAMP` + END maps to a receipt; field order may vary.
- [ ] `TIMESTAMP` exact UTC compact format normalizes to public `bookedAt` only if that DTO field remains.
- [ ] Missing/wrong/blank load ID, booking ref, status, or timestamp fails safely; `BOOKED_AT` is rejected as a substitute and never relied on.
- [ ] Success does not require echoed MC/rate. Any public agreed rate/MC-derived value is proven to come from authorized request context.
- [ ] Wrong load binding or any malformed/incomplete post-write success frame is `UNKNOWN`.
- [ ] `INVALID_RATE`, `UNKNOWN_LOAD`, `ALREADY_BOOKED`, and `MISSING_FIELD` ERRs classify as definitive confirmed rejection.
- [ ] Post-write `SERVER_ERROR`, unknown remote code, timeout, partial/malformed response, and close-before-END classify as `UNKNOWN`; remote MSG is absent from public output/logs.
- [ ] A proven not-sent local failure is not-attempted, not confirmed rejection/unknown committed state.
- [ ] No classifier branch retries, replays, or automatically reconciles `LOAD_BOOK`; attempt ledger/state remains single-consumption.
- [ ] Mock integration emits canonical fields and retains available→BOOKED/duplicate→ALREADY_BOOKED local state behavior.
- [ ] Public real booking remains HTTP `403 REAL_BOOKING_DISABLED`; spies prove no client, capability, ledger, socket, external TMS, or `LOAD_BOOK` access.
- [ ] Focused booking/controlled/mock/route tests, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` pass locally.

## Assumptions, UNKNOWNs, and Non-goals

- Undocumented remote rejection codes and the committed state after post-write transport/protocol/server failure remain `UNKNOWN`; no optimistic or definitive result is inferred.
- `LOAD_GET` is not reconciliation or booking authority, even if it returns `BOOKED`; no automatic detail lookup is added after uncertainty.
- Real booking enablement, a real runner, external socket, credential, approved ID invention, probe, retry, compensation, unbooking, or reconciliation authority is out of scope and prohibited.

## Handoff to `@coder-heavy`

The planner owns this plan. Execute manually only after 5A and 5B pass. This is compatibility prerequisite work, not authorization to enable or invoke real booking. Stop and report `BLOCKED` if any test or implementation requires real TMS access, a retry, an invented remote classification, or weakening `REAL_BOOKING_DISABLED`.
