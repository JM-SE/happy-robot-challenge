# Phase 5B — Read-Only Command Compatibility Specification

**Status:** **PLAN READY — READ-ONLY ONLY; NOT IMPLEMENTED**

## Context

Phase 5B aligns `LOAD_QUERY`, `LOAD_GET`, and `DEBUG_ECHO` after 5A is green. It introduces one canonical load normalizer and one constructive public mapper. It preserves upstream ordering/duplicates and removes private fields from public types. It performs no booking write.

Current evidence: `src/tms/loads.ts` has duplicate public/internal conversion and silently omits malformed miles; `src/tms/public-load-mapper.ts` accepts only `AVAILABLE|BOOKED`, sorts, rejects duplicate IDs, and enforces unsupported RATE/MILES maxima; `src/tms/service.ts` fabricates `UNKNOWN_LOAD` for empty GET. `src/tms/echo.ts` requires a closed exact field set. `LoadPublic` includes notes.

## Requirements

### Canonical load normalization

- [ ] Replace `recordToPublicLoad` and `recordToLoadInternal` with one command-specific `normalizeLoadRecord(record, context)` (or equivalent) returning one canonical internal `NormalizedLoad`.
- [ ] Require and validate the existing core load fields constructively. Distinguish an absent optional field from a malformed present field; malformed present `MILES`, `PICKUP_DT`, `DELIVERY_DT`, status, number, or required text raises safe indexed `TmsUpstreamError` diagnostics without values.
- [ ] Remove arbitrary handbook-unsupported `MAX_PUBLIC_RATE`/`MAX_PUBLIC_MILES` ceilings. Retain finite/domain-safe numeric validation; any additional product safety bound must be separately named, justified, and tested rather than described as a handbook rule.
- [ ] Accept canonical `OPEN` and `BOOKED` read-only statuses. Preserve any other usable non-empty status publicly as an opaque value; do not alias `OPEN`, `POSTED`, `ACTIVE`, or any other value to `AVAILABLE`.
- [ ] Define `MAX_TMS_STATUS_LENGTH=64` as a named product safety bound, chosen from the repository's nearby 64-character identifier convention. After parser padding trim, reject empty/whitespace, `|`/CR/LF/control/framing content, or values over 64; otherwise preserve the exact opaque string without case rewriting.
- [ ] Parse pickup/delivery only from exact 14-digit `YYYYMMDDHHmmss`, validate calendar/time components, and normalize to a timezone-free local datetime representation such as `YYYY-MM-DDTHH:mm:ss`. Do not append `Z`, instantiate a conversion that can shift components, or infer a timezone.
- [ ] Use the same canonical full datetime representation for query/detail stability comparisons. Map only the existing approved public date projection (for example `pickupDate` date components) unless the HTTP contract is deliberately and separately updated; delivery/unknown fields may remain internal.
- [ ] Accept blank or space-padded `NOTES`; any normalized notes retained when needed remain internal/private, and exact padding preservation is not required. Retain `MAX_BUY`, delivery data not in the DTO, and unknown upstream fields only within the internal normalized representation when needed. Never log or expose them.

### Public DTO and query/detail semantics

- [ ] Make private notes, `MAX_BUY`, and opaque unknown fields unrepresentable in `PublicLoadSummary`/`PublicLoadDetail`; remove `notes` from `LoadPublic` or replace the type entirely after callers migrate.
- [ ] Provide one allowlist-only public mapper from `NormalizedLoad` to the existing summary/detail DTOs. Construct field-by-field; do not spread internal records.
- [ ] `LOAD_QUERY` returns every normalized record in upstream order, subject only to the actual response and existing caller-requested output cap. Do not sort, rank, dedupe, or reject duplicate `LOAD_ID` values.
- [ ] Empty `END` from `LOAD_QUERY` maps to `[]`. Server compliance with `MAX_RESULTS` and any server maximum remain `UNKNOWN`; do not fabricate extra client results.
- [ ] `LOAD_GET` accepts exactly one record + END, including `OPEN`, `BOOKED`, past-pickup, or usable opaque status. Zero records is a structural upstream-invalid response, not fabricated remote `UNKNOWN_LOAD`; multiple records is likewise structural invalidity.
- [ ] An actual remote `ERR UNKNOWN_LOAD` remains `TmsRemoteError` with safe public mapping. `ALREADY_BOOKED` parsed on a read-only command also remains a `TmsRemoteError`; do not reinterpret it as a status.
- [ ] Duplicate query IDs remain visible. Any later controlled selection requiring one unambiguous identity may fail closed locally, but must not mutate/dedupe the read-only query result or claim upstream uniqueness.

### ECHO forward compatibility

- [ ] Continue to accept only the known `ECHO` marker plus the existing explicitly tested local legacy markerless shape if required for mock compatibility. Tolerate arbitrary field order and unknown extra fields.
- [ ] For canonical ECHO, require the `ECHO` marker and a present, usable non-negative integer `FIELDS_PARSED` because the existing `EchoResult.fieldCount` API needs it. Missing/blank/invalid `FIELDS_PARSED` is a safe upstream-invalid error; do not invent a count.
- [ ] Canonical response `MSG` presence is `UNKNOWN`: accept it when absent or empty. Project absent `MSG` to `EchoResult.message` as `""` solely for compatibility with the existing local DTO; this projection is not handbook evidence.
- [ ] Canonical response `AUTH` semantics are not sufficiently established. Do not require `AUTH` solely to accept an otherwise successful ECHO; if present, ignore it for public projection and never log or expose it. Do not add or infer an `authenticated` output. Keep unknown extra fields internal/ignored and tolerate their order.
- [ ] If legacy local `FIELD_COUNT` support remains, isolate it as mock compatibility and do not present it as handbook evidence.

## Files / Modules and Boundaries

| Location | Responsibility | Required migration |
| --- | --- | --- |
| `src/tms/load-normalizer.ts` or focused equivalent | Record -> `NormalizedLoad`, required/optional validation, local compact dates, safe diagnostics, internal opaque fields. | Becomes sole load normalizer. |
| `src/tms/public-load-mapper.ts`, `src/tms/public-contracts.ts` | Constructive `NormalizedLoad` -> public summary/detail; bounded opaque status. | Remove sort/dedupe and unsupported maxima/status union. |
| `src/tms/loads.ts` | HTTP input and request-field construction only after extraction. | Remove `recordToPublicLoad`, `recordToLoadInternal`, `toPublicLoad`. |
| `src/tms/service.ts` | Thin query/detail orchestration and record-count semantics. | Remove fabricated zero-record `UNKNOWN_LOAD`. |
| `src/tms/echo.ts` | Command-specific ECHO core validation/public projection. | Remove closed exact-field-set requirement. |
| `src/tms/types.ts`, controlled read-only workflow callers | Canonical internal type and safe public contracts. | Retire misleading `LoadInternal`/`LoadPublic` after migration. |
| `tests/tms/**`, local mock dataset/server as needed | Canonical read-only regression evidence. | No real tests or writes. |

No module may combine parser/socket IO, load normalization, public redaction, and booking policy. Unknown internal fields must never cross logger/error/DTO boundaries.

## Implementation Steps

1. Introduce `NormalizedLoad`, status/date/number helpers, safe indexed diagnostics, and focused pure tests.
2. Migrate service and controlled read-only query/detail callers to the sole normalizer.
3. Replace public load mapping with one constructive allowlist mapper; update public status typing to bounded string semantics and remove notes/private fields.
4. Remove query sorting/deduplication and correct query-empty/GET-empty/remote-error behavior.
5. Relax ECHO only at its command mapper, preserving required API core and privacy.
6. Update local fixtures/mocks to include the canonical three-record CA query with `STATUS:OPEN`, OPEN detail, compact pickup/delivery dates, and compatibility edge cases.
7. Remove old functions/types only after import/caller migration, then run focused and global gates.

## Test and Acceptance Gate

- [ ] A canonical three-record `LOAD_QUERY` with `STATUS:OPEN` returns all three in upstream order.
- [ ] OPEN detail, BOOKED detail, past-pickup detail, and a usable unknown non-empty status succeed; opaque status is preserved exactly.
- [ ] Blank/whitespace, framed/control, or >64 status is a safe mapping failure. No status is aliased to `AVAILABLE`.
- [ ] Duplicate `LOAD_ID` records are preserved in order with no dedupe/sort; controlled selection ambiguity fails locally only when selection is attempted.
- [ ] Query `END`-only returns `[]`. GET `END`-only is upstream-invalid and does not fabricate remote not-found; actual `ERR UNKNOWN_LOAD` remains remote.
- [ ] Exact compact pickup/delivery values normalize component-wise without timezone conversion; invalid calendar/time, wrong length, or malformed present date fails safely.
- [ ] Absent MILES remains absent; malformed present MILES fails with safe field/index metadata and no value.
- [ ] Public DTOs/logs/errors contain no notes, `MAX_BUY`, delivery/opaque fields not allowlisted, AUTH, raw record, or unknown upstream values.
- [ ] Canonical ECHO requires its marker and a usable non-negative integer `FIELDS_PARSED`; missing/blank/invalid `FIELDS_PARSED` fails safely. Missing or empty `MSG` succeeds and projects to `EchoResult.message: ""` as local DTO compatibility only. `AUTH` is not required for acceptance, and present `AUTH`/unknown extras never surface or appear in logs; extra field order is tolerated.
- [ ] A parsed `ALREADY_BOOKED` remains `TmsRemoteError`.
- [ ] Focused load/service/mapper/echo/route/integration tests, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` pass locally.

## Railway Read-only Validation

Only after 5A and 5B are deployed and separately approved, issue exactly one query: `{"originState":"CA","maxResults":5}`. Inspect one-line safe `[tms]` / `[tms-mapping]` logs only. Do not use invented filters/IDs, ECHO, detail, booking, retries, raw frames, secrets, or any additional external request.

## Assumptions, UNKNOWNs, and Non-goals

- Ranking/order meaning, `LOAD_ID` uniqueness, exact server `MAX_RESULTS` compliance/maximum, GET empty-END not-found meaning, pickup/delivery timezone, canonical ECHO `MSG` presence, and response `AUTH` semantics remain `UNKNOWN`.
- `LOAD_GET` status and dates are descriptive, not booking eligibility authority. No availability filter, past-date exclusion, alias, ranking, or dedupe is introduced.
- No `LOAD_BOOK`, booking receipt/outcome change, real runner, secret, or external socket is executed by implementation/tests. The single post-deploy query above is the only separately approved exception.

## Handoff to `@coder-heavy`

The planner owns this plan. Execute manually only after 5A passes. Stop on any need to infer an UNKNOWN, expose an internal field, alter booking write behavior, or run external validation beyond the single separately approved post-deploy query.
