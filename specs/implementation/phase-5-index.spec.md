# Phase 5 — LTMS Handbook Compatibility Implementation Index Specification

**Status:** **PLAN READY — NORMATIVE INDEX; NOT IMPLEMENTED**

## Context

Phase 5 corrects the existing LTMS adapter to the confirmed handbook contract without enabling real booking. The planner owns the decisions and evidence in this index and the linked phase specs. Implementation, integration, and verification are a manual handoff to `@coder-heavy`; this planning artifact authorizes no source/config/test change and no network operation.

The canonical wire contract is TCP + strict ASCII, one CRLF-terminated request line per connection/request, `CMD` first, required `AUTH`, no `|`, CR, or LF in request values, and unknown request fields accepted/discarded. Success is zero or more records followed by `END\r\n`; `ERR|CODE:<code>|MSG:<msg>\r\n` is terminal without `END`. `END`, not peer close, completes success. Field order is unstable; blank/space-padded `NOTES` must be accepted, but exact padding preservation is not required and any normalized internal notes remain private. Duplicate response fields remain invalid pending contrary evidence.

## Phase Map and Sequence

| Phase | Objective | Scope | Non-goals | Exit signal |
| --- | --- | --- | --- | --- |
| **5A — Wire response compatibility** | Correct framing, decoding, limits, terminal behavior, and error mechanics. | ASCII parser, syntax-level empty fields, separate request/response limits, immediate END settlement, delayed close, ERR, config/docs/local tests. | Load/echo/booking business mapping changes. | Wire/config/client gates pass locally with no external access. |
| **5B — Read-only command compatibility** | Align query/detail/echo normalization and public redaction. | One canonical load normalizer, OPEN/BOOKED/opaque statuses, compact dates, query order/duplicates, GET structural behavior, forward-compatible echo, DTO/log privacy. | Booking write execution or booking receipt mapping. | Canonical three-OPEN query and all read-only gates pass. |
| **5C — Booking response alignment** | Prepare safe canonical booking receipt/outcome handling while keeping real writes disabled. | `TIMESTAMP`/`BOOKED` receipt, request-context composition, pure outcome classifier, local mock/tests. | Real booking enablement, real runner, probe, retry, reconciliation authority. | Local booking compatibility gates pass and real HTTP booking remains `403 REAL_BOOKING_DISABLED`. |

- [ ] Execute in strict order **5A → 5B → 5C**. A failed phase gate blocks later phases.
- [ ] Use [`phase-5a-wire-response-compatibility.spec.md`](./phase-5a-wire-response-compatibility.spec.md), [`phase-5b-read-only-command-compatibility.spec.md`](./phase-5b-read-only-command-compatibility.spec.md), and [`phase-5c-booking-response-alignment.spec.md`](./phase-5c-booking-response-alignment.spec.md) as executable instructions.
- [ ] Keep 5B/5C high-level here; their linked specs are normative for the complete compatibility surface.

## Confirmed Contract and Planner Decisions

- [ ] Query/detail canonical status is `OPEN`; booking success status is `BOOKED`. `ALREADY_BOOKED` is remote `ERR`. Never alias `OPEN`, `POSTED`, or `ACTIVE` to `AVAILABLE`.
- [ ] Read-only unknown non-empty statuses are preserved publicly as bounded opaque values. Reject only empty/whitespace, framing-unsafe, or over-bound status values.
- [ ] `LOAD_GET` may return a booked or past-pickup load and is not booking-eligibility authority; only `LOAD_BOOK` is authoritative for booking.
- [ ] Transcript dates are exactly 14 digits `YYYYMMDDHHmmss`. Pickup/delivery have no documented timezone: validate calendar components and normalize without timezone conversion. Booking `TIMESTAMP` is UTC.
- [ ] Canonical successful `LOAD_BOOK` is one record containing `LOAD_ID`, `BOOKING_REF`, `STATUS:BOOKED`, and `TIMESTAMP`, then `END`. `BOOKED_AT`, `MC_NUM`, and `AGREED_RATE` are not response evidence.
- [ ] Confirmed booking rejections are `INVALID_RATE`, `UNKNOWN_LOAD`, `ALREADY_BOOKED`, and `MISSING_FIELD`. Post-write `SERVER_ERROR`, undocumented remote codes, timeout, partial/malformed response, or close-before-END are `UNKNOWN`. Never retry `LOAD_BOOK` automatically.
- [ ] `LOAD_QUERY` empty `END` is valid. Server `MAX_RESULTS` compliance/maximum, ordering/ranking, and `LOAD_ID` uniqueness are `UNKNOWN`; preserve records and upstream order without dedupe or invented ranking.
- [ ] Known `LOAD_GET` success is exactly one record + `END`; observed unknown ID is remote `ERR UNKNOWN_LOAD`. Empty `END` is not confirmed not-found and must be a structural upstream error, not fabricated `UNKNOWN_LOAD`.
- [ ] Handbook request frame maximum is 4096 bytes including terminator. It is not confirmed as a whole-response maximum. Response limits are configurable adapter safety policy, never handbook claims.

## Current Evidence / Migration Targets

- `src/tms/limits.ts` currently couples `DEFAULT_TMS_FRAME_BYTES=4096` with 256-byte lines and 128 records.
- `src/tms/config-core.ts` produces one `maxFrameBytes`; `src/tms/parser.ts` uses it as whole-response authority and applies UTF-8, NOTES-only empty, and global AUTH/CMD semantics.
- `src/tms/client.ts` parses/stores success at `END` but resolves only on socket end/close.
- `src/tms/public-load-mapper.ts`, `src/tms/loads.ts`, and `src/tms/service.ts` currently duplicate mapping, restrict statuses, sort/dedupe, omit malformed miles, expose notes in an intermediate public type, and fabricate GET not-found.
- `src/tms/echo.ts` enforces a closed field set. `src/tms/booking.ts`, `src/tms/controlled-booking.ts`, and `src/tms/types.ts` conflate request context with undocumented booking response echoes.
- `mock/ltms-server.ts` emits legacy booking fields and UTF-8 request/response buffers; local behavior must be aligned only where each phase permits.

## Required Module Boundaries

- [ ] Keep parser mechanics, client/socket orchestration, command normalization, public redaction, and booking policy in separate modules.
- [ ] Add named response-limit configuration/constants; request construction must retain an independently named 4096-byte maximum.
- [ ] Provide one command-specific canonical load normalizer, one allowlist-only public load DTO mapper, one focused booking receipt mapper, and one pure booking outcome classifier.
- [ ] No module may combine wire IO, normalization, public redaction, and booking policy. Unknown upstream fields may be retained only internally and must never be logged or exposed.
- [ ] Remove or rename misleading/duplicate functions and types only after all callers migrate; phase specs name the required cleanup.

## Assumptions and UNKNOWNs

- `MSG` optionality on ERR, response field order, and syntax-level padded/empty values follow the conservative phase rules. For canonical ECHO, `MSG` presence and response `AUTH` semantics remain `UNKNOWN`: Phase 5B requires the `ECHO` marker and usable non-negative `FIELDS_PARSED`, accepts absent/empty `MSG` with an empty-string local DTO projection, and neither requires nor exposes `AUTH`. No undocumented response AUTH/CMD semantics are invented globally.
- Server query ranking, uniqueness, exact `MAX_RESULTS` behavior, GET empty-END semantics, pickup/delivery timezone, and undocumented booking error outcomes remain `UNKNOWN`.
- Adapter response limits are defaults/caps chosen for local safety, not remote guarantees: 64 KiB/1 MiB total, 16 KiB/64 KiB line, and 512/4096 records.

## Global Verification and Safety Gate

For each phase, run focused local tests first, then:

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Confirm logs contain no raw values, AUTH, MSG, NOTES, MAX_BUY, MC, rates, opaque fields, frames, secrets, or remote message text.
- [ ] Do not run `test:real-tms:*`, `tests/tms/real/**`, a real-TMS runner, external socket access, secrets, a `LOAD_BOOK` probe, or invented filters/IDs.

Only after 5A and 5B are deployed, and only with separate deployment approval, perform exactly one Railway read-only validation query: `{"originState":"CA","maxResults":5}`. Inspect only one-line safe `[tms]` / `[tms-mapping]` logs. Do not perform ECHO, detail, booking, retries, extra queries, or raw payload inspection as part of that validation.

## Non-goals

- Enabling real booking, changing the `403 REAL_BOOKING_DISABLED` guard, executing a write, retrying/reconciling a booking, or asserting production readiness.
- Inventing status aliases, ordering, deduplication, eligibility rules, GET not-found behavior, response AUTH/CMD rules, response-wide handbook limits, filters, IDs, timestamps, or remote error classifications.
- Exposing notes, `MAX_BUY`, opaque upstream fields, raw messages/frames, MC, request auth, internal rates, or secrets through DTOs/logs/errors.

## Acceptance Criteria

- [ ] All confirmed decisions above are preserved by exactly one owning phase and are not weakened by a later phase.
- [ ] 5A changes no command-domain semantics; 5B performs no booking write; 5C remains prerequisite-only and cannot enable real `LOAD_BOOK`.
- [ ] Every phase passes focused and global local-only gates before handoff proceeds.
- [ ] Planner ownership and manual `@coder-heavy` execution are explicit; these specs do not implement or authorize runtime operations.

## Handoff to `@coder-heavy`

Execute these specs manually in order, one bounded phase at a time. Report changed files, focused/global checks, assumptions encountered, and blockers after each phase. Stop rather than infer any `UNKNOWN`, weaken privacy/framing rules, access a real socket, run a real runner, or make `LOAD_BOOK` reachable.
