# Phase 4A — Carrier Sales Operations Foundation Specification

**Status:** **PLAN READY — DOMAIN/DATA FOUNDATION ONLY**

## Context

Phase 4A creates the first sanitized Carrier Sales Operations domain/data boundary on top of the Phase 3 contracts. The authoritative inputs are [`phase-3-index.spec.md`](./phase-3-index.spec.md), [`phase-3a-http-integration-contract.spec.md`](./phase-3a-http-integration-contract.spec.md), [`phase-3b-endpoint-domain-contracts.spec.md`](./phase-3b-endpoint-domain-contracts.spec.md), [`phase-3c-deterministic-mock-demo.spec.md`](./phase-3c-deterministic-mock-demo.spec.md), and [`phase-3d-security-configuration-real-mode-gates.spec.md`](./phase-3d-security-configuration-real-mode-gates.spec.md).

The current stack is Next App Router, TypeScript strict, and Vitest. This phase is deliberately transport-independent. It creates safe types, sanitization, an in-memory process-scoped store, deterministic KPI aggregation, synthetic fixtures, and focused tests. It does **not** add APIs, authentication, UI, environment wiring, TCP/TMS changes, real TMS access, or real `LOAD_BOOK`.

HappyRobot remains the owner of voice, FMCSA/OTP providers, negotiation, handoff execution, extraction, and Twin. Phase 4A owns the explicit boundary `unknown raw ingestion payload -> canonical CallRecord`: it accepts the handoff field names, derives canonical statuses and load summaries, and never infers booking success from a tool invocation.

Phase 4A is the first stage of one autonomous `@coder-heavy` execution of **4A → 4B → 4C → 4D**. It starts from the clean baseline whose prior/base commit already contains the single planning commit fixing all five Phase 4 specs. That documentary commit is outside the autonomous run and is not a phase or intermediate implementation commit. Phase 4A is not a standalone handoff cycle: after its technical post-phase gate passes and its separate 4A implementation commit/hash is created, the executor continues automatically with 4B without planner approval.

## Scope, Non-goals, and Dependencies

### Scope

- [ ] Define a closed, safe `CallRecord` domain model and related status/enumeration contracts.
- [ ] Sanitize the handoff raw payload before it can reach storage, silently dropping unknown/forbidden fields and validating approved IDs, timestamps, numbers, enums, notes, enrichment, and MC masking.
- [ ] Provide the exact `CallEventStore` async interface with an in-memory implementation, bounded results, deterministic ordering, fresh test factories, and explicit duplicate behavior.
- [ ] Provide pure KPI aggregation and filter semantics.
- [ ] Provide eight deterministic, synthetic, demo-visible fixtures through a separate canonical-record constructor/factory and a later integration contract for fixture versus ingested records.
- [ ] Add focused Vitest coverage without changing the existing TMS/mocking paths.

### Explicit non-goals

- No Next route, API, HTTP envelope, adapter authentication, authorization, UI, dashboard, or `ADAPTER_UI_DATA_MODE` runtime wiring; 4B owns that wiring.
- No `process.env` reads, including no implementation/consumption of `ADAPTER_UI_DATA_MODE=fixture` in this phase.
- No FMCSA, OTP, voice, negotiation, handoff provider, carrier lookup, AI Extract, or Twin implementation.
- No TCP, parser, transport, client, TMS configuration, `mock/ltms-server.ts`, or existing Phase 3 route changes.
- No real TMS operation, real `LOAD_BOOK`, real booking interpretation, provider evidence, credential, target, secret, or production persistence.
- No database, filesystem, distributed store, cross-instance deduplication, retries, compensation, unbooking, or idempotency authority.

### Dependencies / Inputs

- [ ] Phase 3A–3D contracts remain authoritative for safe boundaries, mock labeling, no leakage, and real-booking denial.
- [ ] Existing TypeScript strict configuration and Vitest runner remain unchanged.
- [ ] No production credentials, hostnames, tokens, MC values, raw frames/lines, internal pricing, or operational identifiers are needed or permitted.
- [ ] Any ingestor must provide `unknown` input to the sanitizer and may call `CallEventStore.insert` only with a sanitized `CallRecord`; fixture construction may use a separate internal canonical-record factory.
- [ ] The five Phase 4 specs are already fixed in one planning commit before implementation begins; its hash is tracked separately from the 4A phase commit.

## Requirements

### Domain invariants

- [ ] The persisted model contains only the closed canonical fields defined below. It never contains raw input, arbitrary metadata, raw/transcript/TCP payloads, secrets, internal pricing, `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, or an equivalent alias.
- [ ] `OperationsMode` is exactly `"demo" | "real-read-only"`. There is no `"real"` mode in this domain contract. `real-read-only` describes read-only provenance and is never interpreted as booking authority or booking success.
- [ ] Every fixture has `source: "fixture"` and `mode: "demo"`; the fixture source is distinct from response metadata and cannot look like real production data.
- [ ] Every ingested record has `source: "ingested"`; `source` is assigned by the sanitizer/factory boundary and is not trusted from raw input.
- [ ] All outputs are constructed field-by-field. Do not use object spread, arbitrary serialization, or a raw-input clone for any persisted or returned object.
- [ ] Unknown and forbidden keys are silently dropped at the ingestion boundary before persistence, without reflecting key or value in an error, log, result, or test snapshot. Malformed approved values fail with a constant safe code; unsafe optional notes are omitted.

### Exact public-to-domain seam

The implementation must expose this interface (names may be namespaced, but methods and return types are fixed):

```ts
interface CallEventStore {
  list(filters: CallFilters): Promise<CallRecord[]>;
  get(callId: SafeIdentifier): Promise<CallRecord | null>;
  insert(record: CallRecord): Promise<CallRecord>;
  summary(filters: CallFilters): Promise<CallSummary>;
}
```

`list` and `summary` use the same inclusive filter semantics. `summary` aggregates every matching record in the bounded store and is not truncated to the list page/result limit.

## Domain Contracts

Use operation-specific types. Do not import `LoadInternal`, `BookingInternal`, `TmsRecord`, `MockBooking`, or any other MC/pricing/raw-bearing TMS type into `src/operations/**`.

```ts
type SafeIdentifier = string & { readonly __brand: "OperationsSafeIdentifier" };
type IsoDateTime = string & { readonly __brand: "OperationsIsoDateTime" };
type SafeDisplayText = string & { readonly __brand: "OperationsDisplayText" };
type SanitizedNote = string & { readonly __brand: "OperationsSanitizedNote" };
type MaskedMc = `MC•••${string}`;

type OperationsMode = "demo" | "real-read-only";
type CallRecordSource = "fixture" | "ingested";

type CallOutcome =
  | "SUCCESS"
  | "OTP_DELIVERY_UNAVAILABLE"
  | "NO_MATCHING_LOAD"
  | "FAILED_NEGOTIATION"
  | "ALREADY_BOOKED"
  | "BOOKING_NOT_ATTEMPTED"
  | "HUMAN_HANDOFF"
  | "TECHNICAL_ERROR";

type FmcsaStatus = "VERIFIED" | "UNAVAILABLE" | "FAILED" | "NOT_RUN";
type OtpStatus = "VERIFIED" | "UNAVAILABLE" | "FAILED" | "NOT_RUN";
type BookingStatus = "NOT_REQUESTED" | "BOOKED" | "ALREADY_BOOKED" | "FAILED";
type HandoffStatus = "NOT_REQUESTED" | "REQUESTED" | "COMPLETED" | "FAILED";
type TechnicalStatus = "SUCCESS" | "ERROR" | "TIMEOUT" | "UNAVAILABLE";

type TimelineStepName =
  | "CALL_RECEIVED"
  | "FMCSA_VALIDATION"
  | "OTP_IDENTITY_CONFIRMATION"
  | "LOAD_SEARCH"
  | "LOAD_DETAIL"
  | "NEGOTIATION"
  | "BOOKING"
  | "HUMAN_HANDOFF";
type TimelineStepStatus = "COMPLETED" | "SKIPPED" | "FAILED";

interface TimelineStep {
  readonly name: TimelineStepName;
  readonly status: TimelineStepStatus;
  readonly occurredAt: IsoDateTime;
  readonly order: number;
  readonly durationMs?: number;
  readonly errorCode?: SafeIdentifier;
  readonly requestId?: SafeIdentifier;
}

interface LoadSummary {
  readonly loadId: SafeIdentifier;
  readonly origin?: SafeDisplayText;
  readonly destination?: SafeDisplayText;
  readonly equipment?: SafeDisplayText;
  readonly publishedRate?: number;
}

interface CallRecord {
  readonly callId: SafeIdentifier;
  readonly occurredAt: IsoDateTime;
  readonly source: CallRecordSource;
  readonly mode: OperationsMode;
  readonly outcome: CallOutcome;
  readonly fmcsaStatus: FmcsaStatus;
  readonly otpStatus: OtpStatus;
  readonly bookingStatus: BookingStatus;
  readonly bookingSuccessful: boolean;
  readonly bookingReference?: SafeIdentifier;
  readonly handoffStatus: HandoffStatus;
  readonly handoffReason?: SafeDisplayText;
  readonly technicalStatus: TechnicalStatus;
  readonly timeline: readonly TimelineStep[];
  readonly matchedLoads: readonly LoadSummary[];
  readonly mcMasked?: MaskedMc;
  readonly notes?: SanitizedNote;
  readonly agreedRate?: number;
}

interface CallFilters {
  readonly fromOccurredAt?: IsoDateTime;
  readonly toOccurredAt?: IsoDateTime;
  readonly callId?: SafeIdentifier;
  readonly loadId?: SafeIdentifier;
  readonly source?: CallRecordSource;
  readonly mode?: OperationsMode;
  readonly outcome?: CallOutcome;
  readonly fmcsaStatus?: FmcsaStatus;
  readonly otpStatus?: OtpStatus;
  readonly bookingStatus?: BookingStatus;
  readonly handoffStatus?: HandoffStatus;
  readonly technicalStatus?: TechnicalStatus;
}

interface CallSummary {
  readonly totalCalls: number;
  readonly fmcsaverified: number;
  readonly fmcsaDenominator: number;
  readonly fmcsaVerificationRate: number | null;
  readonly loadsMatched: number;
  readonly demoBookings: number;
  readonly failedNegotiations: number;
  readonly handoffs: number;
  readonly technicalErrors: number;
}
```

The raw ingestion contract is intentionally separate from this canonical model:

```ts
interface RawOperationsCallPayload {
  readonly callId?: string;
  readonly occurredAt: string;
  readonly mcNumber: string;
  readonly loadId?: string | null;
  readonly agreedRate?: number | null;
  readonly fmcsaverified: boolean;
  readonly otpVerified: boolean;
  readonly bookingSuccessful: boolean;
  readonly bookingRef: string | null;
  readonly outcome: CallOutcome;
  readonly handoffReason: string | null;
  readonly notes: string;
  readonly mode: OperationsMode;
  readonly technicalStatus: TechnicalStatus;
  readonly origin?: string;
  readonly destination?: string;
  readonly equipment?: string;
  readonly publishedRate?: number;
}
```

`callId`, `loadId`, and `agreedRate` are optional raw handoff fields. `loadId` accepts a string or `null`; `agreedRate` accepts a number or `null`. Absence and `null` are equivalent: neither produces a matched load or an agreed rate, and no identifier, rate, or other value is invented. The four enrichment keys are the only other optional additions. The raw payload does not contain `fmcsaStatus`, `otpStatus`, `bookingStatus`, `handoffStatus`, or `matchedLoads`.

`sanitizeCallRecord(raw: unknown)` is the explicit `unknown raw ingestion payload -> canonical CallRecord` boundary. It derives `mcMasked` from raw `mcNumber` without retaining the raw key, silently drops all other unknown/forbidden keys, derives the canonical statuses and a bounded `matchedLoads` list, and constructs the result field-by-field. A separate internal `createCanonicalCallRecord` factory may build fixtures/canonical records and is not an alternate raw ingestion contract. Branded types are compile-time markers only; runtime validation is mandatory. `LoadSummary` never has internal pricing, `MAX_BUY`, `max_rate`, notes, MC, raw payload, or provider data.

### Named bounds and canonical forms

- `MAX_NOTE_LENGTH = 240` characters after sanitization; this is a short operational note, not a transcript.
- `MAX_STORED_CALLS = 10_000` records per process-scoped store; use a named constant and reject at capacity rather than evicting silently.
- `MAX_LIST_RESULTS = 500` records returned by one `list` call; `summary` is not limited by this result cap.
- `MAX_TIMELINE_STEPS = 8`, `MAX_MATCHED_LOADS = 20`, and `MAX_LOAD_ID_LENGTH = 64` are named bounds; values may be tightened, not removed or made client-configurable.
- IDs and references are non-empty, bounded, ASCII-safe identifiers matching `[A-Za-z0-9][A-Za-z0-9._:-]{0,63}`. No framing characters, whitespace-only values, secrets, or raw protocol text are accepted.
- `occurredAt` and timeline timestamps are required canonical UTC ISO strings in `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DDTHH:mm:ss.sssZ` form. Do not accept numeric timestamps, ambiguous dates, or silently substitute the current time.
- Load enrichment text is bounded, normalized, and free of controls/framing markers. No state/city fields beyond the approved `origin`/`destination` strings are invented.
- Rates are JSON numbers, finite, positive when present, bounded by a named Operations rate limit, and limited to two decimal places. Numeric strings, `NaN`, infinities, silent rounding, coercion, and clamping are rejected.
- Enums are case-sensitive closed unions. Do not coerce unknown values to `OTHER`, `SUCCESS`, `NOT_RUN`, or another fallback.

## Sanitization Contract

`src/operations/sanitize.ts` owns the boundary `unknown raw ingestion payload -> canonical CallRecord` and `unknown -> CallFilters`. It returns typed safe failures with constant messages/codes only; it never includes input, unknown key names, raw note/MC, stack, or exception text.

Recommended result shape:

```ts
type SanitizationFailureCode =
  | "INVALID_RECORD"
  | "UNSAFE_RECORD"
  | "INCONSISTENT_BOOKING_RESULT"
  | "INVALID_FILTERS";

type SanitizationResult =
  | { readonly ok: true; readonly record: CallRecord }
  | { readonly ok: false; readonly code: SanitizationFailureCode };
```

### Raw input allowlist and silent drop policy

For an ingested record, the approved raw keys are exactly `callId`, `occurredAt`, `mcNumber`, `loadId`, `agreedRate`, `fmcsaverified`, `otpVerified`, `bookingSuccessful`, `bookingRef`, `outcome`, `handoffReason`, `notes`, `mode`, `technicalStatus`, and the optional safe enrichment scalars `origin`, `destination`, `equipment`, and `publishedRate`. `callId`, `loadId`, and `agreedRate` are optional; `callId` is generated server-side only when absent, while absent/`null` `loadId` yields no match and absent/`null` `agreedRate` yields no agreed rate. No missing value is replaced with an invented identifier, load, or rate. The raw input does not require or accept canonical `fmcsaStatus`, `otpStatus`, `bookingStatus`, `handoffStatus`, or `matchedLoads`.

Unknown and forbidden keys are discarded silently before persistence, including nested keys. Forbidden examples include `MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, `secret`, `secrets`, `token`, `apiKey`, `authorization`, `transcript`, `rawTranscript`, `rawTcp`, `rawFrame`, `rawFrames`, `frames`, `payload`, `requestBody`, `responseBody`, `toolCall`, `toolInvocation`, and any unknown alias. Raw `mcNumber` is allowed only as the input key at this boundary and is never a canonical/output key; `source` and `mcMasked` are sanitizer/fixture outputs. Dropping a key never causes an error or names the key/value. Malformed values of approved fields still fail with a constant safe error.

### Validation and safe construction

- Generate a fresh validated `callId` when it is absent. Tests inject a deterministic generator; production integration may use a server-side UUID generator. Never derive identity from raw text, request ID, MC, or booking reference.
- Require and validate `occurredAt`, the raw booleans, `mode`, `outcome`, and `technicalStatus`. Do not accept `mode: "real"`, `mock`, or `fallback`; `real-read-only` remains read-only.
- Validate every approved ID/reference, number, date, enum, text, and array bound before constructing output. `handoffReason` is optional safe bounded text and is omitted when unsafe. Do not persist the input object or use object spread.
- Derive `fmcsaStatus`: `fmcsaverified === true` maps to `VERIFIED`, otherwise to `UNAVAILABLE` because the raw contract carries no failure/not-run discriminator. Derive `otpStatus` analogously from `otpVerified`.
- Derive `matchedLoads` as zero or one constructive `LoadSummary` from a present, non-null safe `loadId` and optional enrichment scalars; absent or `null` `loadId` yields zero matched loads, with no fabricated ID or load. No raw `matchedLoads` array is accepted. Deduplicate/bound canonical loads and never copy an internal load object.
- Derive `agreedRate` only from a present, non-null valid raw number; absent or `null` `agreedRate` omits the canonical field and never receives a default, calculated, or copied substitute.
- Derive `bookingStatus`: the complete success tuple maps to `BOOKED`; `ALREADY_BOOKED` maps to `ALREADY_BOOKED`; `FAILED_NEGOTIATION` or `TECHNICAL_ERROR` maps to `FAILED`; every other non-success outcome maps to `NOT_REQUESTED`. A `bookingSuccessful: true` is accepted only with a valid `bookingRef`, `outcome: "SUCCESS"`, `mode: "demo"`, and derived canonical `bookingStatus: "BOOKED"`; `outcome: "SUCCESS"` also requires that same complete tuple. Any incomplete/inconsistent combination is `INCONSISTENT_BOOKING_RESULT`. An isolated valid reference or booking attempt never counts as success.
- Derive `handoffStatus`: `outcome: "HUMAN_HANDOFF"` maps to `REQUESTED`, otherwise `NOT_REQUESTED`. The internal canonical constructor may represent `COMPLETED` for fixtures. `real-read-only` records must have `bookingSuccessful: false` and no booking reference.
- Canonical timeline entries contain only the eight known names, `status`, `occurredAt`, `order`, and optional bounded `durationMs`, safe `errorCode`, and safe `requestId`; bound the count, require unique names and strictly increasing order/timestamps. The handoff raw payload does not require a timeline and any raw timeline key is silently dropped; absent steps remain absent for the UI to render as unavailable/not attempted. A booking/tool invocation or attempt alone never counts as booking success.

### MC masking

- Accept only a bounded string under the raw `mcNumber` input key. Never log, throw, return, or store the raw value.
- Canonicalize every valid value to `MC•••<suffix>`. For a value with at least three visible trailing characters, retain exactly the last three; for one- or two-character values, retain only those one or two characters. Thus `MC•••456` remains `MC•••456`, and no short value reveals more than its available one/two-character suffix. Never retain more than three visible characters.
- Recognize an already-masked form without duplicating the prefix; only its final one to three visible suffix characters may survive. Invalid, framed, secret-like, or overlong supplied MC rejects the record with a constant safe error; it never falls back to raw text or omission/pass-through.
- The masked value is the only MC field in canonical/public data. `mcNumber` is never a canonical key and no public mapper may return the full raw value.

### Notes sanitization

- Apply a named `MAX_NOTE_LENGTH` of 240 after normalization. Trim and produce a short single-record representation; deterministically truncate only after safety checks, without silently preserving a suffix that bypasses checks.
- Remove C0/C1 controls and framing bytes. Strip harmless marker bytes, but omit the entire note when protocol/framing markers such as STX/ETX/EOT, NUL, CR/LF, command-like transport markers, `BEGIN`/`END` frame markers, or delimiter injection indicate wire/payload content. If the resulting text is empty, omit `notes`.
- Detect secret-like material such as bearer/basic credentials, JWT/private-key markers, `token=`, `secret=`, `password=`, `api[_-]?key`, credential-shaped pairs, or other configured secret patterns before truncation. Omit the entire note when unsafe rather than attempting a partial redaction that could preserve a secret.
- `notes` is never a transcript, raw transcript, raw TCP line/frame, payload, stack, or diagnostic exception. Store only the bounded sanitized representation; never preserve the original alongside it.

## Store Semantics

`src/operations/store.ts` implements `CallEventStore` with a process-scoped in-memory `Map` (or equivalent) and exports a fresh factory for tests, for example `createInMemoryCallEventStore()`. Do not export a mutable global singleton or a reset endpoint. A later application composition root may retain one instance for the lifetime of a Node process.

- `insert` performs a defensive canonical invariant check and field-by-field safe copy before mutation. It stores only the safe fields of `CallRecord` and returns another safe copy; callers cannot mutate internal state through returned arrays/objects.
- Duplicate `callId` is always a typed deterministic `DUPLICATE_CALL_ID` rejection. There is no upsert, overwrite, implicit dedupe, or same-payload idempotency. The interface exposes no update/delete/reset operation.
- Once `MAX_STORED_CALLS` is reached, insertion rejects with a safe `STORE_CAPACITY_REACHED` error. Do not evict oldest records or silently discard data.
- `list` applies all provided filters with AND semantics, matches `loadId` against any `matchedLoads` entry, sorts deterministically by descending `occurredAt` and then ascending `callId`, and returns at most `MAX_LIST_RESULTS` fresh safe records.
- `get` returns one fresh safe record or `null`; it never returns raw input, an internal reference, a stale fallback, or a fabricated record.
- `summary` uses the same filter predicate and deterministic canonical records, but counts all matching records in the store. Filter parsing/validation must fail safely without reflecting raw filters.
- Restarting Railway or the Node process loses all records, and multiple instances do not share state. This is an explicit limitation, not persistence, idempotency, distributed dedupe, booking evidence, or production authority; 4D must document it.

## KPI Contract

`src/operations/summary.ts` contains pure aggregation (`summarizeCalls` or equivalent) and no store, environment, HTTP, or TMS access.

- `totalCalls`: number of filtered records.
- `fmcsaverified`: count of records whose `fmcsaStatus` is `VERIFIED`.
- `fmcsaDenominator`: count of records whose `fmcsaStatus` is `VERIFIED`, `UNAVAILABLE`, or `FAILED`. `NOT_RUN` is excluded. `fmcsaVerificationRate` is exactly `fmcsaverified / fmcsaDenominator`, represented as a ratio from `0` to `1`; it is `null` when the denominator is zero.
- `loadsMatched`: count of calls with at least one valid `matchedLoads[].loadId`; this is a count of calls with a match, not a sum of load rows.
- `demoBookings`: count only records satisfying the complete booking-success predicate (`bookingSuccessful === true`, non-empty valid `bookingReference`, `bookingStatus === "BOOKED"`, `outcome === "SUCCESS"`) and `mode === "demo"`. Tool invocation, attempted booking, a reference without a closed success outcome, or `real-read-only` never counts.
- `failedNegotiations`: count only `outcome === "FAILED_NEGOTIATION"`.
- `handoffs`: count a record when `outcome === "HUMAN_HANDOFF"` **or** `handoffStatus` is `REQUESTED` or `COMPLETED`. Count each call once even if both conditions hold.
- `technicalErrors`: count a record when `technicalStatus !== "SUCCESS"` **or** `outcome === "TECHNICAL_ERROR"`.

No KPI reads notes, MC, raw payloads, rates, internal ceilings, or arbitrary fields.

## Fixtures and Future Data-Source Contract

`src/operations/fixtures.ts` provides `createDemoFixtures(): CallRecord[]` and returns fresh, independent, deterministic records. All eight fixtures are synthetic and must be visibly demo-safe through `source: "fixture"` and `mode: "demo"`; use fixed timestamps and safe identifiers only. Do not import `mock/dataset.ts` or copy `LoadInternal`, because that dataset includes internal pricing/notes and booking-bearing state.

Required fixture scenarios:

| Scenario | Required safe facts |
| --- | --- |
| Successful FMCSA | `fmcsaStatus: "VERIFIED"`, a safe matched load, no booking success, `technicalStatus: "SUCCESS"`. |
| OTP delivery unavailable | `otpStatus: "UNAVAILABLE"`, `outcome: "OTP_DELIVERY_UNAVAILABLE"`, no booking success. |
| No matching load | `outcome: "NO_MATCHING_LOAD"`, zero matched-load IDs, no booking success. |
| Failed negotiation | `outcome: "FAILED_NEGOTIATION"`, at least one safe matched load, `bookingStatus: "FAILED"`, no booking success. |
| Successful demo booking | Complete strict booking-success tuple, `mode: "demo"`, `source: "fixture"`; any rate is an approved public rate, never internal pricing. |
| Already-booked | `outcome: "ALREADY_BOOKED"`, `bookingStatus: "ALREADY_BOOKED"`, `bookingSuccessful: false`. |
| Technical error | `outcome: "TECHNICAL_ERROR"`, `technicalStatus: "ERROR"` (or another non-success technical status), and FMCSA/OTP may be `NOT_RUN`. |
| Mocked handoff | `outcome: "HUMAN_HANDOFF"`, `handoffStatus: "COMPLETED"` or `"REQUESTED"`, no booking success. |

Fixture IDs and timestamps must be clearly synthetic (for example, a `fixture-...` call ID and `DEMO-LOAD-...` load IDs), not production identifiers. `createDemoFixtures()` must not call TMS, TCP, a route, a provider, or an environment reader.

Reserve the later integration contract now but do not implement it in Phase 4A:

1. `ADAPTER_UI_DATA_MODE=fixture` is wired in 4B, not 4A. In 4B it selects a fresh `createDemoFixtures()` seed and still accepts subsequent sanitized ingestion; unset/empty may start empty and invalid mode fails closed.
2. Ingestion uses `unknown raw ingestion payload -> sanitizeCallRecord -> CallEventStore.insert`; it cannot insert raw objects directly. A separate canonical fixture factory is permitted.
3. `real-read-only` is only a record mode for explicitly trusted read-only data, never a data-source switch or booking mode. There is no `mock` or `fallback` record mode, and no fixture implies a real operation.

## Files / Modules and Responsibility Boundaries

Names may adjust while preserving these responsibilities and the no-API/no-TMS scope:

| Location | Responsibility | Must not own |
| --- | --- | --- |
| `src/operations/contracts.ts` | Closed operation types, branded safe values, enums, named bounds, `CallFilters`, `CallSummary`, raw handoff input, and the exact `CallEventStore` interface. | IO, environment, logging, raw persistence, fixtures, or business side effects. |
| `src/operations/sanitize.ts` | Strict raw handoff/filter validation, silent unknown/forbidden drop, ID generation seam, date/number/enum checks, MC masking, note sanitization, status derivation, booking invariant, and field-by-field construction. | Store mutation, HTTP, auth, UI, TMS imports, or KPI aggregation. |
| `src/operations/store.ts` | In-memory process-scoped map, fresh factory, duplicate/capacity policy, filter predicate, deterministic order, defensive safe copies, and store errors. | Raw parsing, note/MC policy implementation, fixture definitions, HTTP, or KPI rules. |
| `src/operations/summary.ts` | Pure KPI computation and explicit denominator/predicate helpers. | Persistence, environment, raw input, logging, or external IO. |
| `src/operations/fixtures.ts` | Eight fixed synthetic records, fresh fixture factory, demo/source labels, and safe fixture constants. | TMS dataset imports, raw payloads, credentials, dynamic provider calls, or store singleton state. |
| `tests/operations/sanitize.test.ts` | Sanitization, masking, forbidden-key, success-invariant, bounds, and leakage tests. | Real TMS or `LOAD_BOOK`. |
| `tests/operations/store.test.ts` | Exact store API, isolation, filters, ordering, copies, duplicates, capacity, and restart/factory semantics. | Real TMS or `LOAD_BOOK`. |
| `tests/operations/summary.test.ts` | KPI formulas, denominator, unavailable/not-run, dedupe/count-once, and empty-summary tests. | Transport or UI behavior. |
| `tests/operations/fixtures.test.ts` | Eight fixture contract, deterministic output, source/mode visibility, and protected-key absence tests. | Production data or credentials. |
| `tests/operations/contracts.test.ts` | Exact key allowlists, module-boundary/static leakage checks, and no forbidden imports/exports. | Runtime real-provider calls. |

Do not add an `export *` barrel that makes sanitizer internals, raw-bearing compatibility types, or future booking/capability symbols reachable. The exact Phase 4A allowlist is `src/operations/contracts.ts`, `sanitize.ts`, `fixtures.ts`, `store.ts`, `summary.ts`, and `tests/operations/{contracts,sanitize,fixtures,store,summary}.test.ts` (or the existing equivalent test paths only); no `app/**`, config, `.env`, auth, UI, `src/tms/**`, or `mock/**` file is allowed.

## Module Boundaries / Contracts

- **Ingestion boundary:** `unknown raw ingestion payload -> sanitizeCallRecord -> CallRecord`; only the handoff raw keys are read, unknown/forbidden keys are silently dropped, and no raw input enters `store.insert`.
- **Fixture boundary:** `createDemoFixtures() -> CallRecord[]` creates source-labeled, demo-mode safe records without going through a TMS dataset. It may use the same canonical constructors, but never an internal TMS record.
- **Persistence boundary:** `CallRecord -> CallEventStore.insert -> internal Map`; only canonical fields are copied and retained.
- **Read boundary:** `CallFilters -> list/get`; returns fresh safe copies only. Unknown filter keys or invalid bounds fail with safe typed errors.
- **Summary boundary:** filtered canonical records -> pure `CallSummary`; no raw fields are inspected or returned.
- **Future data-source boundary:** `fixture`/`ingested` selection is composed in 4B; Phase 4A does not read `ADAPTER_UI_DATA_MODE` or expose it through an API.

## Data Flow

1. A future fixture or ingested source produces a candidate. In 4A, `createDemoFixtures()` and direct sanitizer tests exist; no route or environment source is wired.
2. Ingested candidates are treated as `unknown`, silently drop unknown/forbidden keys, then validate approved timestamps, IDs, numbers, enums, notes, MC, safe enrichment, and booking invariants. Missing `callId` is generated.
3. Sanitization constructs a new `CallRecord` field-by-field, sets `source: "ingested"`, derives canonical statuses/load summaries, masks MC if valid, and omits unsafe notes. Forbidden/raw fields never survive.
4. The caller inserts only the canonical record into a fresh/process-scoped in-memory store. The store defensively validates/copies it, rejects duplicate IDs/capacity overflow, and never keeps the input object.
5. `list`/`get` apply safe filters and return deterministic fresh copies. `summary` applies the same filter predicate and calculates exact KPIs over all matching records.
6. 4B may select fixture data when `ADAPTER_UI_DATA_MODE=fixture`; it must seed fresh fixtures, accept later sanitized ingestion, preserve `source`/`mode` labels, and never reinterpret them as auth or booking authority.

## Extraction Plan

- Extract all input parsing, safe text normalization, enum checks, array bounds, ID/date/number validation, MC masking, and note safety into `sanitize.ts` before store integration.
- Keep KPI predicates (`isBookingSuccess`, FMCSA denominator, handoff, technical error, matched-load test) pure and named in `summary.ts`; do not hide them inside `store.ts`.
- Keep store state and defensive copying in `store.ts`; do not let it know about raw request shapes, protocol markers, TMS records, fixtures, or HTTP statuses.
- Keep fixtures as declarative safe records/factory output in `fixtures.ts`; do not put scenario branching or mutable state in the fixture module.
- Centralize bounds, regexes, enum tables, safe error codes, and synthetic fixture markers in the appropriate module; do not duplicate literals across routes/tests or embed security limits inline.
- Keep future source selection separate from both the store and UI. `ADAPTER_UI_DATA_MODE` must be consumed by a later composition/config boundary, not by domain modules.

## Modularity Risks

- [ ] **Raw-record mirroring:** importing Phase 3/TMS records or using object spread could reintroduce `maxBuy`, notes, MC, or raw fields. Use operation-specific types and constructive mapping tests.
- [ ] **God store:** combining parsing, sanitization, fixtures, state, KPI logic, and source selection makes leakage/review difficult. Require the module split above.
- [ ] **False booking success:** a tool call, attempted timeline step, booking reference, or `real-read-only` record could be counted incorrectly. Enforce the complete tuple and test negative cases.
- [ ] **Mode confusion:** do not add `real`, `realBooking`, or a boolean that could imply authority. `real-read-only` is never booking.
- [ ] **State leakage:** a mutable singleton, returned internal arrays, upsert, or hidden reset would make tests/order behavior nondeterministic. Use a fresh factory and defensive copies.
- [ ] **Unbounded input:** notes, timelines, load lists, IDs, filters, or store capacity must remain bounded before allocation/storage.
- [ ] **Fixture masquerading:** fixtures must remain source-labeled and demo-mode, fixed/synthetic, and disconnected from `mock/ltms-server.ts` and TMS execution.
- [ ] **Inconsistent analytics:** `list` and `summary` must share filter semantics, while summary must not inherit the list result cap.

## Technical Approach

Implement a small, pure-first domain layer:

1. Freeze operation-specific types, closed unions, safe brands, named bounds, filter fields, and KPI output.
2. Build the sanitizer as a constructive boundary. It must silently drop unknown/forbidden keys without reflection, fail safely on malformed approved values, mask MC, omit unsafe notes, derive canonical fields, and enforce the booking-success tuple.
3. Build a factory-created in-memory store with bounded map state, duplicate rejection, no upsert/dedupe, deterministic list order, defensive copies, and a safe typed error surface.
4. Implement pure summary aggregation using the exact formulas above, including `fmcsaverified`, `fmcsaDenominator`, and `fmcsaVerificationRate`.
5. Add fixture construction with eight fresh, deterministic, source=`fixture`, mode=`demo` records.
6. Test each seam independently and verify that no module imports Next, TMS, TCP, auth, config, providers, or real booking code.

The implementation must remain additive and isolated to the exact Phase 4A allowlist above. It must not alter Phase 3 routes/contracts, `src/tms/**`, `mock/**`, environment configuration, or runtime behavior.

## Implementation Steps

1. Inventory the Phase 3 contracts and freeze the operation field allowlist, forbidden-key list, closed enums, named limits, and exact store interface.
2. Add `contracts.ts` with operation-only types, the raw handoff interface, and no raw-bearing TMS imports.
3. Add `sanitize.ts` with strict runtime validation, injected call-ID generation, canonical timestamp/number checks, bounded timeline/load mapping, MC masking, safe-note handling, and booking-success invariants.
4. Add `store.ts` with the fresh in-memory factory, defensive field-by-field copies, deterministic filtering/order, `MAX_STORED_CALLS`/`MAX_LIST_RESULTS`, duplicate rejection, and capacity rejection.
5. Add `summary.ts` with pure KPI predicates and the exact FMCSA denominator/rate behavior.
6. Add `fixtures.ts` with the eight required synthetic/demo fixtures and no `mock/dataset.ts`/TMS dependency.
7. Add focused operation tests, including silent drop/key-leakage/static-boundary checks and fresh-store/concurrency-order cases. Do not add API, auth, UI, config, TCP, TMS, or real-runner tests.
8. Run the focused and repository-local verification plan. Stop and report **BLOCKED** if any change needs real TMS, `LOAD_BOOK`, credentials, a new API, or a Phase 3 boundary change.

## Edge Cases

- Missing call ID generates a validated ID; malformed supplied ID rejects, and no raw candidate is used as fallback.
- Missing or `null` `loadId` produces no match, and missing or `null` `agreedRate` omits the canonical rate; neither absence is converted into invented data.
- Missing/ambiguous/invalid `occurredAt`, duplicate timeline order/name, invalid enum, numeric string, over-limit number, invalid date, or overlong identifier rejects safely.
- Unknown keys at the top level or any nested object are silently dropped without naming the key/value. Forbidden secret/raw keys never reach a response or log; malformed approved values still reject safely.
- Unsafe notes are omitted; notes that remain are <= 240 characters, single-record, control/protocol-free, and not transcript-like.
- Invalid supplied `mcNumber` rejects with a generic safe error; raw MC never persists, returns, logs, or appears in errors. Masked values never preserve more than three trailing visible characters.
- A record with `bookingSuccessful: true` but no valid `bookingRef`, non-`SUCCESS` outcome, non-`demo` mode, or any inconsistent derived booking result rejects and never counts. A tool invocation, HTTP 200, isolated reference, or booking attempt alone is not booking success; `real-read-only` never has success/reference.
- `NOT_RUN` FMCSA/OTP is explicit. FMCSA `UNAVAILABLE` is counted in the FMCSA denominator; FMCSA `NOT_RUN` is reported but excluded.
- Zero matching loads means `loadsMatched` does not increment; a single call with multiple canonical matched loads counts once.
- Repeated insertion of one call ID rejects with `DUPLICATE_CALL_ID`; no upsert, overwrite, implicit idempotency, eviction, or reset endpoint exists.
- Empty store summary returns zero counts, `fmcsaDenominator: 0`, and `fmcsaVerificationRate: null`.
- Process restart/fresh factory resets in-memory data. Railway restart or multiple instances must be documented as non-persistence, not hidden behind fixture behavior.

## Test Plan

### Sanitization tests

- [ ] Missing call ID generation with an injected deterministic generator; invalid IDs, dates, numbers, enums, array bounds, and dangerous/framing text fail with safe codes only.
- [ ] Exact handoff input allowlist accepts `mcNumber` only at the raw boundary and silently drops forbidden/unknown examples (`MAX_BUY`, `maxBuy`, `max_rate`, `maxRate`, internal pricing, secrets, transcript/rawTranscript, rawTcp/raw frames, payload/requestBody/responseBody, `mcNumber` as canonical/output, tool invocation) without reflecting names or values; approved malformed values fail safely.
- [ ] MC tests cover `mcNumber` string values, `MC•••456`, one-/two-character values, invalid/masked-overlong forms, and prove only the canonical `MC•••` mask can persist.
- [ ] Note tests cover controls, protocol/framing markers, secret-like patterns, empty/overlong notes, deterministic shortening, and absence of raw/original text.
- [ ] Optional raw `loadId`/`agreedRate` tests prove omission and explicit `null` have identical no-match/no-agreed-rate behavior and never fabricate data. Booking tests prove only the complete literal-`true`/reference/`BOOKED`/`SUCCESS`/`demo` tuple is successful; tool invocation and attempted timeline steps never count.
- [ ] Timeline/load-summary tests prove the exact eight-step vocabulary, allowlisted optional metadata/bounds, unique ordered steps, safe enrichment/rate mapping, no internal pricing, and no raw record retention.

### Store and summary tests

- [ ] `CallEventStore` has exactly `list`, `get`, `insert`, and `summary` with the specified async return types.
- [ ] Fresh factories are isolated; returned records/arrays cannot mutate stored state; process-scoped lifetime and no-reset/no-update/no-delete behavior are explicit.
- [ ] Duplicate IDs reject with `DUPLICATE_CALL_ID`; no upsert or implicit dedupe occurs. Capacity rejects with `STORE_CAPACITY_REACHED` without eviction.
- [ ] Filters use AND semantics, inclusive time bounds, `loadId` matching over nested matched loads, deterministic occurredAt/callId ordering, and list result bounds.
- [ ] Summary uses all matching records rather than `MAX_LIST_RESULTS`, returns a safe empty summary, and has no raw-field dependency.
- [ ] KPI fixtures/test records prove FMCSA verified/unavailable/failed/not-run denominator behavior, `null` zero-denominator rate, one-count-per-call loads, strict demo bookings, exact failed negotiation, handoff OR/count-once rule, and technical error OR rule.

### Fixture and boundary tests

- [ ] Exactly eight required fixture scenarios exist, are deterministic across fresh factory calls, use fixed synthetic identifiers/timestamps, and all have `source: "fixture"` and `mode: "demo"`.
- [ ] Fixture objects and all store outputs contain no forbidden keys or raw payloads, internal rates/ceilings, secrets, raw MC, transcripts, TCP frames, or tool payloads; approved `agreedRate`/`publishedRate` may appear only in their canonical safe fields.
- [ ] Static/import checks prove the Phase 4A allowlist does not import `app/**`, `src/tms/**`, `mock/**`, environment/config/auth/provider/capability modules, or real runner code.
- [ ] Tests confirm `ADAPTER_UI_DATA_MODE=fixture` is not read or wired in Phase 4A and is reserved for 4B.
- [ ] No test opens a real socket, contacts a real TMS, executes `LOAD_BOOK`, or uses real credentials/targets.

## Verification Plan

Run repository-local checks only; adjust focused test paths if the implementation chooses equivalent names without changing intent:

- [ ] `npx vitest run tests/operations/sanitize.test.ts tests/operations/store.test.ts tests/operations/summary.test.ts tests/operations/fixtures.test.ts tests/operations/contracts.test.ts`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test` (must remain local/mock-safe and must not contact a real TMS)
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Review changed imports/exports and recursively inspect safe outputs for forbidden keys, raw notes, MC, internal pricing, secrets, payloads, or object-spread leakage.
- [ ] Do **not** run `npm run test:real-tms:echo`, `npm run test:real-tms:loads`, `npm run test:real-tms:booking`, any real runner, real socket, real provider, or real `LOAD_BOOK`.

## Rollback / Safety Notes

- Keep Phase 4A isolated. If unsafe, revert only the exact Phase 4A allowlist; do not add a fallback API, raw record path, TMS adapter, or environment switch.
- If sanitization, masking, or KPI invariants are incomplete, fail closed and mark the phase blocked rather than storing candidates or counting ambiguous bookings.
- Do not replace process-scoped state with an unapproved persistent/distributed mechanism in this phase. Document Railway restart/multi-instance loss rather than implying durability.
- Preserve all Phase 3 default-deny, mock-labeling, no-retry, `rollbackAvailable=false`, raw-wire privacy, and real `LOAD_BOOK` exclusion behavior.
- A requested change that makes real TMS/`LOAD_BOOK` reachable, introduces auth/API/UI/config work, exposes protected data, or weakens the strict success predicate is a blocker, not an implementation detail.

## Acceptance Criteria

- [ ] Phase 4A starts from a clean baseline whose prior/base commit contains the single planning commit for all five Phase 4 specs; the planning/spec hash is reported separately and is not a 4A or inter-phase commit.
- [ ] Operation-specific strict types exist for `CallRecord`, `CallSummary`, filters, outcome, FMCSA, OTP, booking, handoff, technical status, modes, timeline steps, and safe load summaries.
- [ ] `CallEventStore` has exactly `list(filters): Promise<CallRecord[]>`, `get(callId): Promise<CallRecord|null>`, `insert(record): Promise<CallRecord>`, and `summary(filters): Promise<CallSummary>`; the implementation is in-memory, process-scoped, bounded, deterministic, fresh-factory testable, and explicit about `DUPLICATE_CALL_ID` conflict/no upsert/no overwrite/no idempotency.
- [ ] The exact handoff raw payload is accepted with optional `callId`, `loadId?: string | null`, and `agreedRate?: number | null`; absent and `null` load/rate values have the same no-match/no-agreed-rate semantics, approved values are strictly validated, unknown/forbidden fields are silently dropped, and no raw input or dropped key/value is persisted or reflected.
- [ ] MC is stored only as a canonical `MC•••` mask retaining at most the last three visible characters (one/two for short values); raw MC never persists, returns, logs, or appears in errors.
- [ ] Notes are optional, bounded by named `MAX_NOTE_LENGTH = 240`, short and sanitized; controls/protocol markers/secret-like data are removed or cause omission, and raw/transcript/payload data is never retained.
- [ ] `MAX_BUY`, `maxBuy`, `max_rate`, internal pricing, secrets, transcript/rawTranscript/rawTcp/raw frames, tool payloads, and unknown keys are absent from persisted records and store responses.
- [ ] Booking success is counted only for literal `bookingSuccessful === true` plus a valid `bookingRef`, derived `bookingStatus: "BOOKED"`, `outcome: "SUCCESS"`, and `mode: "demo"`; tool invocation, HTTP 200, isolated reference, and attempt alone never count.
- [ ] KPIs exactly implement `totalCalls`, `fmcsaverified`, `fmcsaDenominator`, `fmcsaVerificationRate` (ratio/null), `loadsMatched` per call, `demoBookings`, `failedNegotiations`, `handoffs` once, and `technicalErrors` as specified.
- [ ] Eight required fixtures are synthetic, deterministic, fresh, visibly `source: "fixture"`/`mode: "demo"`, and disconnected from TMS/TCP/`LOAD_BOOK`.
- [ ] `ADAPTER_UI_DATA_MODE=fixture` is not implemented or consumed in 4A; 4B will seed fixtures and accept subsequent sanitizer-first ingestion. Ingested records have `source: "ingested"` and fixtures `source: "fixture"`.
- [ ] No APIs, auth, UI, config, `process.env`, TCP, TMS, `mock/`, or real-booking files change as part of Phase 4A; only the exact Phase 4A allowlist changes.
- [ ] Focused and repository-local verification passes without real TMS or real `LOAD_BOOK` execution.

## Handoff to `@coder-heavy`

The handoff must provide a clean baseline whose prior/base commit already contains the single planning commit fixing all five Phase 4 specs. Record that planning/spec hash separately; it is not the 4A commit or an inter-phase implementation commit. After the 4A gate passes, the executor records the distinct 4A phase hash and continues autonomously.

Implement Phase 4A as the first stage of the single autonomous Phase 4 run. `@coder-heavy` may change only the exact Phase 4A allowlist: `src/operations/contracts.ts`, `src/operations/sanitize.ts`, `src/operations/fixtures.ts`, `src/operations/store.ts`, `src/operations/summary.ts`, `tests/operations/contracts.test.ts`, `tests/operations/sanitize.test.ts`, `tests/operations/fixtures.test.ts`, `tests/operations/store.test.ts`, and `tests/operations/summary.test.ts`. Do not implement `ADAPTER_UI_DATA_MODE`, APIs, auth, UI, TCP/TMS integration, credentials, real providers, or real `LOAD_BOOK`; do not skip or reorder later phases. The planner performs only the initial handoff and does not implement, commit, or approve between phases. After the post-phase technical gate below passes, create the separate 4A commit and record its actual hash, then continue automatically with 4B in the same run without waiting for human approval. Stop and report **BLOCKED** if any requirement would make an ambiguous/unclean record persistent, expose protected data, treat `real-read-only` as booking, or make real TMS/`LOAD_BOOK` reachable.

## Post-Phase Gate

This is an automatic technical gate, not a human approval step. A PASS is required before the executor may create the 4A implementation commit and continue to 4B. The prior planning/spec commit does not satisfy this gate.

- [ ] Focused operation sanitizer/store/summary/fixture/contract tests pass.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass in the local mock-safe environment.
- [ ] `git diff --check` passes.
- [ ] Review `git diff --name-only` (or the repository-equivalent changed-file report) and confirm only the exact Phase 4A allowlist changed; no API, auth, UI, config, `.env`, `src/tms/**`, `mock/**`, TCP, TMS, or real-runner file changed.
- [ ] Confirm no real TMS connection, real socket, credentials, real provider, or real `LOAD_BOOK` was executed; confirm no raw input, MC, secret, note, transcript, payload, `MAX_BUY`, `max_rate`, or internal pricing leaked into records, outputs, logs, or tests.
- [ ] Report the final files changed, checks and exact commands run, known limitations (including process-scoped non-persistence, Railway restart/multi-instance loss, and no `ADAPTER_UI_DATA_MODE` wiring), the planning/spec commit hash separately, and the actual resulting 4A phase commit hash/current HEAD hash; never invent or conflate hashes.
- [ ] After all checks PASS, create the separate 4A implementation commit: `feat(operations): add sanitized event foundation`, and report its actual phase hash.
- [ ] If any check is blocked or any safety condition fails: mark Phase 4A **BLOCKED**, do not create the 4A commit, do not claim readiness, and do not begin Phase 4B. No planner intervention or approval is required to trigger this stop.
