# Phase 5A — Wire Response Compatibility and Limits Specification

**Status:** **PLAN READY — WIRE/CONFIG ONLY; NOT IMPLEMENTED**

## Context

Phase 5A aligns generic LTMS response parsing and socket completion with the confirmed handbook contract. It owns encoding, framing, generic field syntax, duplicate detection, adapter response limits, terminal ERR/END behavior, and lifecycle cleanup. It must not change load, echo, or booking business semantics.

Current evidence: `src/tms/parser.ts` decodes strict UTF-8, permits empty only for `NOTES`, globally restricts `AUTH`/`CMD`, and applies `maxFrameBytes`, a 256-byte line cap, and 128-record cap. `src/tms/client.ts` stores the terminal result at `END` but waits for end/close. `src/tms/config-core.ts` uses `TMS_MAX_FRAME_BYTES` for both request builder and parser.

## Requirements

### Generic parser contract

- [ ] Decode bytes as strict ASCII; reject every byte `> 0x7F` with a safe `TmsProtocolError`. Do not decode as UTF-8 or log the offending bytes.
- [ ] Parse CRLF lines incrementally. Success is zero or more records followed by `END\r\n`; return immediately when `END` is parsed.
- [ ] Reject isolated LF, invalid/incomplete CRLF, unsupported bare markers, malformed/invalid identifiers, duplicate fields, and bytes in the same received chunk after `END`.
- [ ] Preserve the known bare `ECHO` marker only. At wire level, accept syntactically valid unknown fields and empty values for every field; command normalizers own required/non-empty/business semantics.
- [ ] Do not globally reject or interpret response `AUTH` or `CMD`. Do not invent command reflection/authentication semantics.
- [ ] ERR is exactly one terminal `ERR|...\r\n` line with no `END`. Require a present, trimmed, non-empty, framing-safe/bounded `CODE`; allow absent or empty `MSG`, retain it only internally if safely bounded, and never expose/log remote message text publicly.
- [ ] Preserve duplicate-field rejection unless later handbook evidence explicitly changes it.

### Named limits and configuration

- [ ] Keep request maximum `MAX_TMS_REQUEST_FRAME_BYTES=4096`, including CRLF. Request builder and request-side mock enforcement use only the request limit.
- [ ] Add response safety-policy constants with exact defaults/caps: total response `65_536` / `1_048_576` bytes; line `16_384` / `65_536` bytes; records `512` / `4096`.
- [ ] Add exact env names `TMS_MAX_RESPONSE_BYTES`, `TMS_MAX_RESPONSE_LINE_BYTES`, and `TMS_MAX_RESPONSE_RECORDS`, parsed as positive integers with the caps above. Defaults are mandatory and unambiguous.
- [ ] Rename runtime config `maxFrameBytes` to `maxRequestBytes` after callers migrate and add a typed response-limits object (`maxBytes`, `maxLineBytes`, `maxRecords`, or equally explicit names).
- [ ] Keep `TMS_MAX_FRAME_BYTES` only as a deprecated compatibility input for `maxRequestBytes`, with default/max 4096; it never controls any response limit. Do not add a second request env unless implementation evidence requires it.
- [ ] Label all response limits in README/`.env.example`/deployment docs as adapter safety policy, not handbook limits. Update config tests and sanitized error messages without exposing env values.

### Client terminal lifecycle

- [ ] In `onData`, settle success immediately when parser returns at `END`; clear timers/listeners/admission/deadline resources, resolve once, and deterministically destroy/close the one-request socket.
- [ ] Do not wait for peer end/close. A delayed or absent peer close after `END` cannot produce timeout or alter the resolved result.
- [ ] Same-chunk trailing bytes after `END` remain protocol-invalid before settlement. Bytes that could arrive only after completed settlement/destruction are irrelevant to the completed transaction.
- [ ] Close/end before `END` calls parser finish and remains incomplete/protocol failure as appropriate. ERR settles as an error without waiting for close or END.

## Files / Modules and Boundaries

| Location | Responsibility | Must not own |
| --- | --- | --- |
| `src/tms/limits.ts` and optional focused `src/tms/response-limits.ts` | Named request/response defaults and hard caps. | Env reads, parser state, command fields. |
| `src/tms/config-core.ts`, `src/tms/types.ts` | Parse env into separate request and response config. | Wire parsing or domain mapping. |
| `src/tms/parser.ts` | ASCII/framing/identifier/duplicate/size mechanics and terminal records. | Load/echo/booking required fields or statuses. |
| `src/tms/client.ts` | Socket/timer/admission orchestration and END settlement. | Command normalization or public DTO mapping. |
| `.env.example`, `README.md`, `docs/deployment/railway.md` | Exact env names, defaults/caps, deprecation, safety-policy wording. | Secrets or real targets. |
| `tests/tms/{parser,client,config}.test.ts` and focused integration tests | Local deterministic contract evidence. | Real runners/network. |

Update mock/fault helpers only where needed to exercise fragmentation, delayed termination, bounds, or terminal behavior. No command payload/domain shape changes belong to 5A.

## Migration / Removal Plan

1. Introduce separate named constants/config fields and migrate parser/client/request-builder callers.
2. Remove `DEFAULT_TMS_FRAME_BYTES` as shared request/response authority; retain a clearly request-only compatibility alias only if an unmigrated local caller requires it.
3. Rename parser constructor/`parseResponse` arguments from `maxFrameBytes` to response-limit options.
4. Remove NOTES-only empty handling and global AUTH/CMD restrictions from `parseFields`; move no business rule into their place.
5. Remove `terminalResult`/end-close success dependency after immediate END settlement is covered.

## Implementation Steps

1. Freeze current request-builder behavior and add the response-limit constants/config/default/cap tests.
2. Refactor parser construction to receive all three response limits and implement strict ASCII plus syntax-only field parsing.
3. Implement terminal ERR rules and safe optional MSG retention without public/log leakage.
4. Refactor client settlement to resolve/destroy on END while preserving same-chunk trailing-byte validation and single settlement.
5. Update local mocks/fault seams and configuration/deployment documentation.
6. Run focused tests, then the global local-only gate. Stop on any domain mapper change or external dependency.

## Test and Acceptance Gate

- [ ] Fragmented records, CR/LF boundaries, `END`, and ERR parse correctly across arbitrary local chunks.
- [ ] `END` resolves before a deliberately delayed socket close and no response timeout fires.
- [ ] Bytes in the same chunk after `END` are rejected; close/end before `END` is incomplete; cleanup/release happens exactly once.
- [ ] Canonical ERR is terminal without END. Missing/blank/unsafe CODE rejects; absent/empty MSG is accepted internally and never leaked.
- [ ] Any byte `>0x7F` rejects as non-ASCII, including otherwise valid UTF-8 sequences.
- [ ] A syntactically empty ordinary field parses; a focused command-mapper fixture proves a required blank is rejected outside the parser.
- [ ] Unknown fields and arbitrary order parse; duplicate fields and unsupported bare markers reject.
- [ ] Responses exceeding total, line, or record configured bounds each reject independently at the boundary.
- [ ] Defaults and hard caps parse exactly; zero, non-integer, and over-cap env values fail closed. Deprecated `TMS_MAX_FRAME_BYTES` affects request only.
- [ ] A request over 4096 bytes including CRLF rejects; response settings cannot raise that request maximum.
- [ ] Captured one-line logs/errors contain no raw line/value, AUTH, MSG, NOTES, MAX_BUY, secret, or byte dump.
- [ ] Focused parser/client/config tests, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` pass.

## Assumptions, UNKNOWNs, and Non-goals

- The 4096 handbook maximum is request-only for this implementation; a whole-response handbook maximum is `UNKNOWN`.
- Duplicate response-field semantics and arbitrary response AUTH/CMD meaning are `UNKNOWN`; duplicate rejection is retained and no AUTH/CMD semantics are invented.
- No load status/date/order/privacy change, echo shape relaxation, booking receipt mapping, HTTP contract change, real TMS test, external socket, secret, or `LOAD_BOOK` occurs in 5A.

## Handoff to `@coder-heavy`

The planner owns this plan. Execute manually as the first bounded Phase 5 slice. Do not proceed to 5B until the complete local gate passes; report `BLOCKED` rather than coupling response limits back to request limits or adding command business rules to the parser.
