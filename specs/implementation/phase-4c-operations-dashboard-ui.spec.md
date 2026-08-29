# Phase 4C — Read-Only Operations Dashboard UI Specification

**Status:** **PLAN READY — Phase 4C UI-only implementation slice**

## Context

Phase 4C adds a server-session-protected, read-only operations dashboard on top of the Phase 4A canonical foundation and the Phase 4B APIs/auth boundary. It provides operational visibility into calls, FMCSA/OTP progress, load matching, demo booking outcomes, handoffs, and safe integration capability/limitation status.

The repository is a minimal Next.js App Router + TypeScript application. `app/layout.tsx` and `app/page.tsx` are minimal, and there is no CSS system or UI library to extend. Reuse existing conventions discovered in the repository and Phase 4B, but do not add a framework, UI library, charting library, or new backend/TCP/TMS capability.

This phase is UI-only and read-only. It must not change TCP/TMS behavior, expose adapter credentials, create mutations, or make real `LOAD_BOOK` reachable. The dashboard consumes the existing Phase 4B session-protected, read-only API contracts; any DTO/path adaptation belongs at one client boundary rather than in individual components.

No Figma link, design extraction, screenshot, or pixel-level visual contract is supplied. A Visual Fidelity Contract therefore does not apply. Visual decisions are derived from the written requirements and must be verified through manual visual QA at desktop and tablet widths.

Phase 4C is the third stage of the same autonomous `@coder-heavy` execution. It starts only after 4B's automatic technical gate PASS and observed 4B phase commit/hash from this run. The single planning commit that fixed all five Phase 4 specs is a prior baseline artifact, not a phase or inter-phase commit. After its own PASS and separate 4C implementation commit, execution continues automatically to final phase 4D. No planner approval is required between phases, and the sequence cannot be skipped or reordered.

## Dependencies / Inputs

- [ ] Phase 4A foundation and its canonical `CallRecord`, raw-to-canonical derivations, status semantics, safe error/request-ID rules, and sanitized operational data.
- [ ] Phase 4B read-only operations API contracts and UI-session authentication helper, with its automatic gate PASS and observed 4B phase commit/hash. The prior planning/spec commit is tracked separately; Phase 4C must not invent a parallel API or authentication mechanism.
- [ ] Next.js App Router, React, TypeScript, existing Vitest/react-dom/tooling, and native browser APIs only.
- [ ] Existing repository conventions, if any, for server redirects, session checks, API response envelopes, test placement, and local styles.
- [ ] No Figma, design link, raw transcript, raw TCP frame, credential, API key, production target, or real TMS access.

## Scope, Non-goals, and Invariants

### In scope

- `/operations` dashboard route.
- `/operations/calls/[callId]` read-only call detail route.
- Server-side UI-session protection for both routes.
- Dashboard header, environment badge, limitation banners, freshness/refresh controls, KPI cards, filters, bounded recent-calls table, and integration-health panel.
- Call detail overview, load/booking summaries, sanitized notes, and the ordered call timeline.
- Responsive desktop/tablet layout, semantic accessible HTML, keyboard/focus behavior, contrast, text/icon status indicators, and local CSS/module styles.
- Deterministic loading, empty, error, partial-data, unauthorized, and not-found behavior.

### Explicit non-goals

- Any TCP/TMS adapter, transport, parser, protocol, configuration, auth-key, or backend mutation change.
- New API routes, new API capabilities, or a browser-side proxy that forwards adapter credentials.
- Real TMS traffic, real `LOAD_BOOK`, production booking, booking retry, or any state mutation.
- Charts, live streaming, polling, optimistic updates, or client-side business-rule decisions.
- Book, Retry, Force booking, MAX_BUY editing, OTP bypass, manual state override, or any equivalent control.
- Full/raw transcript display, raw TCP display, unmasked MC display, internal pricing, `MAX_BUY`, `max_rate`, auth/API keys, or full sensitive notes.

### Invariants

- [ ] Both pages authenticate on the server with the Phase 4B UI session boundary before rendering protected content.
- [ ] The browser receives only safe, allowlisted, read-only DTOs. It never receives an adapter key, TMS token, auth secret, or raw environment configuration.
- [ ] All data operations are read-only `GET`-equivalent calls through the existing Phase 4B API; refresh is another bounded read and is not a mutation.
- [ ] The UI does not claim persistence or cross-instance consistency; it may show the safe limitation that the process-scoped store is lost on Railway/process restart and is not shared across instances.
- [ ] A successful booking badge appears only when the backend predicate defined by Phase 4A/4B explicitly says the booking succeeded. A booking reference, HTTP success, or non-empty rate is not sufficient.
- [ ] Demo booking, not attempted, failed/unknown booking, and real booking disabled remain visibly distinct.
- [ ] No UI control can reach real `LOAD_BOOK`, alter MAX_BUY/internal pricing, bypass OTP, or override backend state.

## Files / Modules

The paths below are the Phase 4C implementation allowlist. Phase 4C must not modify `src/tms/**`, `mock/**`, or unrelated application/configuration files.

- [ ] `app/operations/page.tsx` — server route shell; require the UI session, then render the dashboard client orchestrator with only safe initial/session context.
- [ ] `app/operations/calls/[callId]/page.tsx` — server detail route shell; validate the route parameter, require the UI session, and render the read-only detail client composition.
- [ ] `src/operations/ui/OperationsDashboard.tsx` — client orchestration for filter, refresh, and view state; compose focused presentational components.
- [ ] `src/operations/ui/Header.tsx` — title, environment badge, last-updated text, and refresh control.
- [ ] `src/operations/ui/LimitationsBanner.tsx` — explicit Twin quota fallback, OTP delivery unavailable, and real `LOAD_BOOK` disabled notices.
- [ ] `src/operations/ui/KpiGrid.tsx` and `src/operations/ui/KpiCard.tsx` — the seven required KPI cards and safe unavailable/zero states.
- [ ] `src/operations/ui/Filters.tsx` — outcome, FMCSA, OTP, booking, mode, and date-range controls.
- [ ] `src/operations/ui/CallsTable.tsx` — bounded recent-calls table with links to details and no mutation controls.
- [ ] `src/operations/ui/StatusBadge.tsx` — reusable status text/icon/tone presentation; color is never the only status signal.
- [ ] `src/operations/ui/IntegrationHealth.tsx` — renders the centralized static capability/limitation set received through server-safe props/config; it does not call a health endpoint or perform live checks.
- [ ] `src/operations/ui/Timeline.tsx` — fixed-order detail timeline and step metadata.
- [ ] `src/operations/ui/CallOverview.tsx` — masked MC, mode, outcome, handoff, and technical summary.
- [ ] `src/operations/ui/LoadSummary.tsx` — load ID, origin, destination, equipment, canonical `publishedRate`, and agreed rate.
- [ ] `src/operations/ui/BookingSummary.tsx` — booking state/reference with a copy-reference action only when a safe reference exists.
- [ ] `src/operations/ui/SanitizedNotes.tsx` — collapsed/expandable sanitized notes only; no raw transcript or sensitive notes.
- [ ] `src/operations/ui/EmptyState.tsx`, `LoadingState.tsx`, and `ErrorState.tsx` — deterministic reusable state presentations.
- [ ] `src/operations/client/operations-api.ts` — same-origin, session-aware, read-only fetch helper and allowlisted Phase 4B response mapping.
- [ ] `src/operations/model/types.ts` — safe UI view models using canonical names (`mcMasked`, `fmcsaStatus`, `otpStatus`, `bookingStatus`, `bookingSuccessful`, `bookingReference`, `outcome`, `handoffStatus`, `technicalStatus`, `mode`); no internal adapter/TMS types.
- [ ] `src/operations/model/status.ts` — centralized status vocabulary, mapping, and display copy.
- [ ] `src/operations/model/config.ts` — filter options, KPI definitions, timeline order, table limits, and limitation copy.
- [ ] `src/operations/lib/formatters.ts` — pure safe date, duration, rate, identifier, and count formatters.
- [ ] `src/operations/lib/filters.ts` — pure filter validation/serialization and deterministic filter application where the 4B contract permits it.
- [ ] `src/operations/ui/operations.module.css` or equivalent local CSS module — responsive layout, focus, contrast, badges, table, timeline, and state styling without a CSS framework.
- [ ] `tests/operations/ui/**` — focused Vitest tests for pure mapping/formatting and render behavior where the current tooling supports it.

The exact Phase 4C allowlist is the two page files above, `src/operations/ui/**`, `src/operations/client/operations-api.ts`, `src/operations/model/**`, `src/operations/lib/**`, one local CSS module, and `tests/operations/ui/**`. Do not modify `app/layout.tsx`, `app/page.tsx`, `src/operations/contracts.ts`, `sanitize.ts`, `store.ts`, `summary.ts`, 4B API/auth/config files, `src/tms/**`, `mock/**`, unrelated app/configuration files, or add an `app/api/**` route.

## Module Boundaries / Contracts

### Server route and session boundary

- `app/operations/page.tsx` and `app/operations/calls/[callId]/page.tsx` are Server Components unless the existing auth convention requires an equivalent server boundary.
- Each route must call the existing Phase 4B UI-session guard before rendering protected content. An unauthenticated request redirects to the established UI login route or returns the established safe unauthorized result; it must not render a partial dashboard.
- Route shells own session/route-param gating and composition only. They do not fetch arbitrary adapter data, read raw environment values, implement status rules, or serialize session secrets.
- The detail route must pass only a bounded, validated `callId` to the read-only detail path. It must not accept MC, rate, booking, mode, or auth values from the URL as authority.
- Session expiry during a browser fetch maps to the established session-expired/unauthorized state and must not reveal API details.

### Client API boundary

`src/operations/client/operations-api.ts` is the only client module that knows Phase 4B API paths, envelopes, query names, request IDs, and wire DTO shapes.

- Use same-origin requests with the existing UI-session credentials/cookies. Do not send or construct `X-Adapter-API-Key`, `ADAPTER_SHARED_SECRET`, `TMS_AUTH_TOKEN`, or equivalent browser credentials.
- Use only the existing Phase 4B read-only operations endpoints. Do not add an API route, call a TCP/TMS endpoint from the browser, or use a mutation method for refresh/detail/filter reads.
- Send only an allowlisted filter query: outcome, FMCSA, OTP, booking, mode, and validated date range. Do not serialize raw notes, MC, rates, credentials, or arbitrary query keys.
- Parse a bounded success envelope into safe UI view models. Reject malformed/unknown responses into a safe error state; do not fall back to rendering raw JSON.
- Preserve a bounded `requestId` for safe error display where 4B supplies one. Do not display raw exception text, stack traces, headers, frames, or target details.
- Use one in-flight request per view, cancel superseded requests where practical, and ignore stale responses after a newer filter/refresh request.
- A failed refresh may retain the last successful bounded data while showing an inline safe error and the last known update. An initial failure shows the full error state.

### Safe UI view models

The API boundary must map to view models containing only the fields needed below. Names may follow the 4B DTO, but internal/raw records must not cross the boundary.

```ts
type OperationsMode = "demo" | "real-read-only";

type UiState =
  | "SUCCESS_STATE"
  | "FAILED_STATE"
  | "NOT_ATTEMPTED_STATE"
  | "UNAVAILABLE_STATE"
  | "DISABLED_STATE"
  | "IN_PROGRESS_STATE"
  | "UNKNOWN_STATE";

interface CallRow {
  occurredAt: string;
  source: "fixture" | "ingested";
  mcMasked?: string;
  fmcsaStatus: UiState;
  otpStatus: UiState;
  loadId?: string;
  agreedRate?: number;
  bookingReference?: string;
  bookingStatus: UiState;
  bookingSuccessful: boolean;
  outcome: CallOutcome;
  handoffStatus: UiState;
  technicalStatus: UiState;
  mode: OperationsMode;
  callId: string;
}

interface TimelineItem {
  name: "Call received" | "FMCSA validation" | "OTP identity confirmation"
    | "Load search" | "Load detail" | "Negotiation" | "Booking"
    | "Senior representative handoff";
  status: UiState;
  timestamp?: string;
  durationMs?: number;
  safeErrorCode?: string;
  requestId?: string;
}

type IntegrationHealthKey = "twin" | "fmcsa" | "otp" | "loadboard-read" | "load-book";
type IntegrationHealthState = "UNAVAILABLE" | "NOT_CONFIGURED" | "DISABLED" | "SAFE_SIGNAL";

interface IntegrationHealthItem {
  key: IntegrationHealthKey;
  state: IntegrationHealthState;
  label: string;
  detail: string;
  lastCheckedAt?: string;
  safeErrorCode?: string;
}
```

`UiState` is private presentation-only vocabulary, not an API/query/persistence contract or an accepted outcome/status alias. It is derived only after validating the uppercase canonical 4A/4B statuses and outcomes; wire inputs, filters, and persisted records accept only those exact canonical values. `outcome` remains the canonical uppercase `CallOutcome`, never an arbitrary or lower-case string.

The detail view model additionally contains canonical `mcMasked`, `matchedLoads` (with `loadId`, optional `origin`, `destination`, `equipment`, `publishedRate`), `agreedRate`, `bookingReference`, `bookingSuccessful`, `bookingStatus`, `outcome`, `handoffStatus`, safe detail-only `handoffReason`, sanitized/canonicalized detail-only `notes` of `<=240` characters, `mode`, `technicalStatus`, adapter status, and the exact eight-item timeline above. Optional fields remain absent/`undefined`; components must not infer values from other fields. List view models contain neither `notes` nor `handoffReason`.

The dashboard data model contains the seven KPI count values plus backend `fmcsaVerificationRate`, the bounded recent-call list, the safe integration-health items supplied by server-safe static props/config, limitation state/copy, and `lastUpdatedAt` when supplied by 4B. KPI values and rate must come from the backend aggregation contract rather than being recomputed from the bounded table.

### Dashboard behavior and visible contract

- Header title is exactly **Carrier Sales Operations**.
- The environment badge must show **Demo/Mock** for canonical `mode: "demo"` and **Real Read-Only** for canonical `mode: "real-read-only"`. These are the only `OperationsMode` values. An unknown mode is an error/unavailable state, never an implicit Demo/Mock fallback or another accepted alias.
- Show a visible freshness area with **Last updated** and a **Refresh** control. Use backend `lastUpdatedAt` when provided; if absent, label the local value as fetch time rather than claiming backend freshness.
- Render three distinct mandatory limitation notices in a clearly labeled limitations region; the dashboard must always render all three:
  - **Twin quota fallback** — use the known safe static limitation copy; state that the local projection is active/used and do not imply live or native Twin availability.
  - **OTP delivery unavailable** — state that delivery is unavailable and that the UI is observing recorded status only; do not offer an OTP bypass.
  - **Real `LOAD_BOOK` disabled** — state that real booking is disabled; never imply that the dashboard can enable it.
- Render exactly these seven KPI count concepts: total calls, `fmcsaverified`, loads matched, demo bookings, failed negotiations, human handoffs, and technical errors, plus the additional backend `fmcsaVerificationRate`. Preserve the backend count, denominator semantics, and unknown values. If a rate has no valid denominator, display `—`, not `0%`; the rate never replaces the count.
- Render filters for outcome, FMCSA, OTP, booking, mode, and date range. Options and copy are centralized; date ranges are validated and bounded. Filter changes only read data or filter the already safe dataset.
- Render a bounded recent-calls table. It must never request or render an unbounded “all calls” result; use the Phase 4B server cap and a named UI cap (recommended `MAX_RECENT_CALLS = 50`, reduced if 4B is stricter). If more records exist, state that the table shows the latest bounded subset.
- Do not render charts. The dashboard uses cards, a table, statuses, and the integration-health panel.

### Recent calls table

The table must expose these columns, in a stable accessible order:

1. Timestamp
2. Masked MC
3. FMCSA
4. OTP
5. Load ID
6. Agreed rate
7. Booking ref
8. Outcome
9. Handoff
10. Technical status
11. Demo/real mode

Each row may link to `/operations/calls/[callId]`. It must not include Book, Retry, Force booking, Edit MAX_BUY, OTP bypass, or manual override controls. Empty values use centralized safe copy such as `—`, `Not attempted`, `Unavailable`, or `Disabled`; do not fabricate success.

Rows consume canonical `mcMasked`, `fmcsaStatus`, `otpStatus`, `bookingStatus`, `bookingSuccessful`, `bookingReference`, `outcome`, `handoffStatus`, `technicalStatus`, `mode`, safe `loadId`, and `agreedRate`; they never receive or render raw `mcNumber`.

### Detail timeline and summaries

The timeline must always render the following exact eight display steps, mapped from the canonical 4A names, in this order even when a step is missing or not attempted:

1. Call received
2. FMCSA validation
3. OTP identity confirmation
4. Load search
5. Load detail
6. Negotiation
7. Booking
8. Senior representative handoff

`CALL_RECEIVED` maps to Call received, `FMCSA_VALIDATION` to FMCSA validation, `OTP_IDENTITY_CONFIRMATION` to OTP identity confirmation, `LOAD_SEARCH` to Load search, `LOAD_DETAIL` to Load detail, `NEGOTIATION` to Negotiation, `BOOKING` to Booking, and `HUMAN_HANDOFF` to Senior representative handoff. Each step renders its mapped status and, only when present and valid, a timestamp, duration, safe error code, and useful bounded `requestId`. Missing metadata is omitted rather than inferred. The UI must preserve the distinction between failed, not attempted, unavailable, disabled, and unknown.

The detail page must show:

- Masked MC.
- Load ID, origin, destination, equipment, canonical `publishedRate`, and agreed rate.
- Booking reference and booking outcome/status.
- Safe detail-only handoff reason.
- Sanitized/canonicalized detail notes only, `<=240` characters, collapsed by default and expandable with a native accessible disclosure or equivalent; list views never contain `notes` or `handoffReason`.
- Demo/Mock for `mode: "demo"` or Real Read-Only for `mode: "real-read-only"`.
- Safe adapter status.

Record provenance, when displayed, is the canonical `source: "fixture" | "ingested"`; it must not be confused with envelope `meta.source: "adapter-fallback"`. `adapter-fallback` is never an `OperationsMode`.

The booking summary must show a successful-booking badge only for the explicit Phase 4A backend predicate: literal `bookingSuccessful === true`, valid `bookingReference`, `outcome === "SUCCESS"`, `mode === "demo"`, and canonical `bookingStatus === "BOOKED"`. It must distinguish **Demo booking**, **Not attempted/failed**, and **Real booking disabled**. It may expose **Copy booking ref** only when the backend returned a safe booking reference; copy failure is a non-mutating inline status and never a reason to retry booking.

### Integration health

`IntegrationHealth` does not consume a new API and does not perform a live check. It receives, through server-safe props/config, only a centralized static set of safe capability/limitation items known by the product. The set represents Twin as unavailable/quota-limited, OTP delivery as unavailable, real `LOAD_BOOK` as disabled, and FMCSA/loadboard-TMS read status only from an existing safe signal when one is explicitly supplied. If a signal is absent, the item is `Unavailable` or `Not configured`; the panel must never infer `healthy`, `available`, or `real`.

The static items must cover Twin, FMCSA recorded-status capability, OTP delivery, loadboard/TMS read access, and booking capability/limitation. A loadboard/TMS read item may show a positive/available state only when the server passes a bounded safe signal already known to the product; otherwise it remains `Not configured`/`Unavailable`. Each item has text/icon status, safe display copy, and optional bounded last-checked time or safe error code. The panel must not reveal credentials, host/port/target data, raw adapter diagnostics, or imply that a disabled capability is actionable. The three mandatory limitation banners remain separate and are not replaced by this panel.

### States and status mapping

Centralize status labels, icons, tones, limitation copy, integration-health items, and field fallbacks in `src/operations/model/status.ts`, `config.ts`, and equivalent pure modules. Use a closed mapping from 4A/4B values; unknown values map to a neutral **Unknown**/**Unavailable** presentation and never to green/success. No lower-case outcome/status alias is accepted at the API, query, or persistence boundary.

Required deterministic states:

- **Loading:** accessible busy indicator and skeleton/placeholder structure; no stale mutation controls.
- **Success:** complete safe data with freshness, limits, and all required sections.
- **Empty:** clear message when no calls exist or filters match no calls; preserve filter controls and allow Refresh.
- **Error:** safe error code/message and bounded request ID where available; provide Refresh only, never Retry booking or another mutation.
- **Partial data:** render available safe sections and mark missing integration/KPI/step data as unavailable; do not infer from the table.
- **Unauthorized/session expired:** server redirect initially; safe session-expired handling for later fetches.
- **Detail not found:** safe not-found state without echoing the `callId` into diagnostics or exposing raw backend text.

### Formatting and security rules

- Masking must happen in the backend DTO where possible and be preserved by the UI. If a formatter receives an unmasked MC, it must not render it; use a safe masked placeholder and report the contract violation in tests/review.
- Format dates only from bounded valid timestamps, with an explicit consistent timezone (UTC unless 4B defines another display timezone). Invalid/missing values render `Unavailable`/`—`; never show `Invalid Date`.
- Format durations as bounded milliseconds/seconds/minutes according to centralized rules. Reject negative, non-finite, or oversized values to safe fallback copy.
- Format rates with locale-aware numeric formatting. Append a currency only when an allowlisted currency is supplied by 4A/4B; never invent USD, `$`, or another unit. Never render `MAX_BUY`, `max_rate`, internal pricing, or raw rate fields.
- Do not render auth/API keys, `ADAPTER_SHARED_SECRET`, `TMS_AUTH_TOKEN`, raw TCP lines/frames, full/raw transcripts, full sensitive notes, unmasked MC, or internal request payloads in DOM, URL, logs, errors, or client state.
- Request IDs may appear only as bounded safe correlation values in error/timeline context. They do not authorize, select mode, or enable booking.

## Extraction Plan

- **Pure transformation:** map 4B envelopes to closed UI view models in the API boundary; keep KPI interpretation, success-predicate handling, timeline ordering, and status normalization outside JSX.
- **State and side effects:** keep fetch, filter, refresh, abort/stale-response handling, and clipboard feedback in the client orchestration/helper seams. Presentational components receive props and do not fetch or read session state.
- **Validation:** validate route IDs, query filters, dates, counts, timestamps, rates, status values, and bounded response collections at the API/model boundary. Unknown/forbidden raw ingestion fields are already silently dropped by 4A; unknown or malformed API responses are rejected into a safe UI state and never rendered wholesale.
- **Central configuration:** name and centralize `MAX_RECENT_CALLS`, filter options, KPI definitions, exact timeline order, mode/status maps, the static integration-health capability/limitation items, limitation copy, `Demo/Mock` UI label, `adapter-fallback` envelope metadata label, `fixture|ingested` record-source labels, table column labels, and formatting bounds.
- **Reusable UI:** share `StatusBadge`, `Header`, state components, limitation presentation, safe summaries, and formatters between dashboard/detail where appropriate. Use native links, buttons, table markup, and disclosure elements before adding abstractions.
- **Security seam:** keep all adapter/TMS credentials and server-only session implementation private to Phase 4B. The 4C browser client receives neither keys nor raw config.

## Modularity Risks

- [ ] Do not make `OperationsDashboard` or either route page own fetching, session policy, filter validation, mapping, business rules, copy, formatting, and all rendering at once.
- [ ] Do not duplicate status/copy maps across KPI cards, table, timeline, health, and booking summary.
- [ ] Do not compute backend KPIs from the bounded recent-calls table or infer booking success from presentation fields.
- [ ] Do not let a generic fetch helper accept arbitrary methods, paths, headers, or query objects; keep the operations client allowlisted and read-only.
- [ ] Do not pass raw API envelopes into components; map once to safe view models.
- [ ] Do not create a shared UI abstraction that hides semantics or makes status color-only; native accessible markup remains the contract.
- [ ] Do not add a fallback that changes `OperationsMode`, bypasses session auth, exposes raw data, or makes a disabled booking appear successful. Local fallback behavior is a data/limitation projection only; it is not a mode alias.

## Visual Fidelity Plan (if Figma/UI fidelity applies)

- [ ] **Visual Fidelity Contract:** Not applicable. No Figma, design link, reference screenshot, pixel contract, or visual extraction was provided.
- [ ] **Figma context / raw extraction / reference screenshot:** None exists; do not invent one.
- [ ] **Visual-first execution order:** The Figma-specific order is not applicable. Build from written requirements, then perform manual visual QA after behavior is integrated.
- [ ] **Atomic visual components:** Header, limitation notice, KPI card, filter control, status badge, table cell, health item, timeline item, summary section, disclosure, and state views.
- [ ] **Composition/layout:** dashboard shell, responsive KPI/filter/table grid, detail two-column-to-single-column summary layout, and vertical timeline using local CSS.
- [ ] **Shared component adaptations:** None known. Reuse repository components only if they exist and preserve semantics/contrast; otherwise implement local focused components.
- [ ] **Blocking visual criteria:** unreadable/overlapping content, broken desktop/tablet layout, inaccessible focus, insufficient contrast, clipped table/detail data, or color-only status meaning blocks completion.
- [ ] **Accepted visual exceptions:** exact colors, spacing, typography, and pixel values are intentionally unspecified; record any browser/platform limitation in the phase report rather than claiming Figma fidelity.
- [ ] **Manual visual QA targets:** `/operations` populated/empty/loading/error states and `/operations/calls/[callId]` populated/partial/not-found states at representative desktop and tablet widths.
- [ ] **Visual inspection checklist:** responsive layout, table overflow strategy, keyboard focus, contrast, status text/icon redundancy, banner readability, no charts, no prohibited controls, and no sensitive values visible.

## Technical Approach

1. Authenticate the request in the Server Component route shell using Phase 4B, pass only server-safe static integration-health props/config, then compose a client dashboard/detail view over existing same-origin read-only APIs.
2. Normalize all API data once into safe UI view models. Keep backend predicates authoritative for booking success, KPI semantics, limitations, mode, and technical status.
3. Use a thin client orchestrator for filters/refresh and focused presentational components for the dashboard and detail sections. Centralize status/copy/config/formatting as pure modules.
4. Apply local CSS modules only. Prefer semantic HTML (`header`, `main`, `section`, `form`, `table`, `caption`, `thead`, `tbody`, `details`, `nav`) and native keyboard behavior.
5. Test pure seams and critical render/security behavior with existing Vitest/react-dom tooling where available, then complete manual visual, prohibited-control, and leakage review. Do not add a testing framework merely for this phase.

## Implementation Steps

1. Inventory the exact Phase 4A/4B read-only DTOs, session helper, envelopes, status values, backend booking-success predicate, and endpoint paths. Freeze the 4C safe UI view-model boundary before writing components.
2. Create the two server route shells with server-side session protection and bounded `callId` handling. Confirm neither route reads raw environment values or serializes secrets.
3. Implement the allowlisted client API helper for dashboard/detail reads, filter serialization, bounded responses, safe errors/request IDs, cancellation, and stale-response protection. Keep every operation read-only.
4. Add pure types, constants, status/copy mappings, exact timeline order, filter options, table/KPI configuration, and safe formatters. Add tests for unknown/missing/invalid values before composing the UI.
5. Build `OperationsDashboard` and its focused dashboard components: header, the three mandatory limitation banners, seven KPI counts plus the backend FMCSA rate, filters, bounded table, static-props-only integration health, and loading/empty/error states. Do not add a health endpoint, live check, or TMS request.
6. Build the detail composition: `CallOverview`, `LoadSummary`, `BookingSummary`, `SanitizedNotes`, fixed-order `Timeline`, safe adapter status, and read-only navigation back to the dashboard.
7. Add local responsive CSS for desktop/tablet widths, keyboard/focus states, contrast, table overflow, badges, banners, and timeline. Use no charting or UI framework.
8. Add focused tests for view-model mapping, booking predicate behavior, status distinctions, exact timeline order, formatting, filter bounds, leakage/prohibited controls, and supported render states using existing tooling only.
9. Perform manual QA with populated fixture, empty result, API error, populated detail, partial detail, not-found detail, and unauthenticated/login scenarios at desktop and tablet widths.
10. Run the post-phase gate. If any check finds a secret/raw-data leak, unauthorized route, mutation control, real `LOAD_BOOK` reachability, or unexpected file, stop Phase 4C and report the blocker; do not compensate with a backend/TMS change.

## Edge Cases

- [ ] Unauthenticated initial navigation never flashes protected dashboard/detail content; it follows the established Phase 4B login/session behavior.
- [ ] A session expiring during refresh/detail fetch produces a safe unauthorized state and no raw response display.
- [ ] Initial empty data, filter-empty data, partial aggregation, missing timeline steps, and missing integration signals remain distinguishable from API failure; absent health signals display `Unavailable`/`Not configured` rather than inferred healthy/real status.
- [ ] Missing booking attempt is **Not attempted**; real-mode booking is **Real booking disabled**; demo success is **Demo booking** only when the Phase 4A predicate is true; all other cases are not successful.
- [ ] A booking reference without the backend success predicate never receives a successful-booking badge.
- [ ] Invalid/negative/oversized numbers, dates, durations, IDs, status values, or collection lengths use safe fallbacks and do not break the page.
- [ ] Unknown mode never defaults to Demo/Mock; it maps to unavailable/error and remains non-actionable.
- [ ] A refresh race cannot replace newer filtered data with an older response; refresh remains a GET-only operation.
- [ ] A refresh failure retains last-known safe data only when such data exists and clearly marks it as stale/error; initial failure uses the full error state.
- [ ] No calls beyond the named bounded limit are fetched/rendered. No “load all” control is introduced.
- [ ] Date range and filter values cannot inject arbitrary query keys or sensitive values; no sensitive identifier is added to URL state.
- [ ] Clipboard permission denial is handled without mutation, retry booking, or exposing the booking reference in a broader log.
- [ ] Missing currency never receives an invented `$`/USD label. Invalid timestamps never display `Invalid Date`.
- [ ] Narrow desktop/tablet widths preserve readable table/detail content through bounded overflow or an explicitly accessible layout; no content is silently clipped.
- [ ] Every status remains understandable without color, and every interactive element is keyboard reachable with visible focus.

## Verification Plan

### Focused automated tests

- [ ] Pure formatter tests cover masked-ID enforcement, safe date/timezone formatting, duration/count bounds, optional currency handling, and fallback copy.
- [ ] Status/config tests cover all required distinctions: success, failed, not attempted, unavailable, disabled, in progress, unknown, Demo/Mock, and Real Read-Only. They also prove that lower-case outcome/status aliases are not accepted wire/query/persistence values and that `UiState` remains private presentation vocabulary.
- [ ] Mapping tests assert only allowlisted API fields reach UI models and prohibited fields (`MAX_BUY`, `max_rate`, internal pricing, raw notes/transcript, raw TCP, credentials, unmasked MC) are not rendered or retained in client view models.
- [ ] Booking tests prove the successful badge depends only on the Phase 4A/4B backend predicate and distinguish demo booking, not attempted, failed/unknown, and real booking disabled.
- [ ] Timeline tests assert the exact eight-step order, optional metadata behavior, safe error-code/request-ID handling, and missing-step rendering.
- [ ] Filter/client tests assert allowlisted query serialization, bounded date ranges, read-only methods, safe error mapping, request-ID preservation, cancellation/stale-response behavior, and no adapter-key header.
- [ ] Component/render tests, when supported by the existing Vitest/react-dom setup, cover populated, loading, empty, error, partial, unauthorized, and detail-not-found states; assert list has no `notes`/`handoffReason`, detail has only sanitized/canonicalized `notes` `<=240` and safe detail `handoffReason`, and do not add a new test framework to enable them.
- [ ] Integration-health tests prove the panel uses only the centralized static server-safe props/config, shows `Unavailable`/`Not configured` without a signal, never displays inferred healthy/real status, makes no health/TMS request, and leaves the three mandatory banners intact.
- [ ] Static/security review tests or inspection prove no 4C browser module imports server-only auth/config/secrets and no UI path invokes `LOAD_BOOK` or a mutation method.

### Manual QA matrix

- [ ] Desktop populated dashboard: title, environment badge, three limitation banners, freshness/refresh, all seven KPIs, filters, bounded table, and health panel.
- [ ] Tablet populated dashboard: responsive layout, readable/accessible table behavior, no overlap/clipping, focus visibility, and banner readability.
- [ ] Loading fixture/state: dashboard and detail have stable structure, busy semantics, and no actionable mutation controls.
- [ ] Empty fixture/state: initial empty and filter-empty messages are clear and retain safe filters/refresh.
- [ ] Error fixture/state: safe message/code/request ID, no raw backend text, refresh only, and last-good-data behavior on refresh failure.
- [ ] Detail fixture: exact timeline order, timestamps/durations only when present, safe error codes/request IDs, all required detail fields, safe detail-only handoff reason, sanitized/canonicalized notes disclosure `<=240`, and copy booking reference; the list fixture contains neither `notes` nor `handoffReason`.
- [ ] Detail edge fixture: no booking, demo booking, real-read-only/booking-disabled, missing steps, failed negotiation, handoff reason, and adapter/integration degradation.
- [ ] Login/session fixture: unauthenticated dashboard/detail navigation follows the server-side session guard without a protected-content flash.
- [ ] Keyboard/contrast review: landmarks, labels, table headers, links/buttons, disclosure, focus ring, status text/icon redundancy, and non-color-only meaning.
- [ ] Prohibited-control/security review: no Book, Retry, Force booking, MAX_BUY edit, OTP bypass, manual override, raw transcript/TCP, secret/API key, internal pricing, full note, or unmasked MC.
- [ ] No real TMS, real endpoint, real socket, or real `LOAD_BOOK` operation is executed during tests or manual QA.

### Post-phase gate

This is an automatic technical gate, not a human approval step. A PASS plus the observed 4C implementation commit/hash from this run is required before the executor may continue automatically to final phase 4D. The prior planning/spec commit does not satisfy this gate.

- [ ] UI-focused automated tests and the complete manual QA matrix pass.
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Visual review confirms the written-requirements layout at desktop/tablet widths; no Figma/Visual Fidelity Contract claim is made.
- [ ] Prohibited-control, security, session, browser-secret, raw-data, and real-booking reachability review passes.
- [ ] Unexpected-file review confirms that only the explicitly approved Phase 4C UI/module/test files changed; no `src/tms/**`, `mock/**`, unrelated config, or unrelated app files changed.
- [ ] The phase report lists changed files, every check and result, known limitations/dependencies, the separately identified planning/spec commit hash, and the actual 4C phase commit hash plus a diff/hash identifier when available; never invent or conflate a hash.
- [ ] After all checks PASS, create the separate 4C implementation commit: `feat(operations): add read-only operations dashboard`, and report its actual phase hash.
- [ ] Any blocker means **do not create the 4C commit or proceed to Phase 4D**. A blocked gate must be reported with the failing check and safe limitation; do not weaken auth, expose data, add mutation controls, or enable real `LOAD_BOOK` to make the gate pass. No planner intervention or approval is required to trigger this stop.

## Rollback Plan

- [ ] Revert only the exact Phase 4C allowlist (the two pages, `src/operations/ui/**`, the operations client/model/lib files, local CSS, and `tests/operations/ui/**`) if rollback is needed; preserve Phase 4A/4B APIs/auth and all prior safety controls.
- [ ] If a read contract is incomplete, keep the route protected and show a safe unavailable/error state; do not add a new backend/TCP/TMS path or client-side secret fallback.
- [ ] If a leakage, mutation, or real-booking reachability issue is discovered, remove/block the affected UI path and report it before any Phase 4D handoff.
- [ ] Rollback must not add retries, booking compensation, manual state overrides, OTP bypasses, raw diagnostics, or mode switches.

## Acceptance Criteria

- [ ] Phase 4C inherits a clean baseline containing the single prior planning/spec commit for all five Phase 4 specs; its hash is distinct from the 4A/4B/4C phase hashes and is not an inter-phase commit.
- [ ] `/operations` and `/operations/calls/[callId]` exist as read-only UI routes and are protected server-side by the Phase 4B UI session.
- [ ] The dashboard renders **Carrier Sales Operations**, **Demo/Mock** only for `mode: "demo"` or **Real Read-Only** only for `mode: "real-read-only"`, last-updated information, Refresh, the three mandatory limitation banners, seven required KPI counts plus the backend FMCSA rate, all six required filter categories, a bounded calls table, and integration health from static server-safe props/config only; no health endpoint or live check exists.
- [ ] The table renders timestamp, masked MC, FMCSA, OTP, load ID, agreed rate, booking ref, outcome, handoff, technical status, and demo/real mode in accessible semantic table markup.
- [ ] The detail page renders the exact eight timeline steps in the required order, with status and only-present safe timestamp/duration/error-code/request-ID metadata.
- [ ] The detail page renders masked MC, load fields, both rates when available, booking reference/outcome, safe detail-only handoff reason, sanitized/canonicalized notes `<=240`, mode, and adapter status; list output contains neither `notes` nor `handoffReason`.
- [ ] The UI may display record provenance only as `source: "fixture" | "ingested"`; it keeps that field separate from response metadata `meta.source: "adapter-fallback"`.
- [ ] Successful-booking badges are driven exclusively by the full Phase 4A/4B predicate. Demo booking, not attempted/failed, and real booking disabled are visibly distinct; isolated references and HTTP success are not success.
- [ ] Allowed actions are limited to view, filter, refresh, copy booking reference, and expand sanitized notes. No booking mutation, MAX_BUY edit, OTP bypass, or manual override exists.
- [ ] No UI/API/client state/log/error leaks `MAX_BUY`, `max_rate`, internal pricing, auth/API keys, full/raw transcript, raw TCP, original/full/raw notes, or unmasked MC; only sanitized/canonicalized detail `notes` `<=240` and safe detail `handoffReason` may appear, never in list; the browser never receives adapter keys.
- [ ] No TCP/TMS code, real endpoint, real socket, or real `LOAD_BOOK` behavior changes or becomes reachable in Phase 4C.
- [ ] Loading, empty, error, partial, unauthorized, session-expired, and detail-not-found states are deterministic, safe, accessible, and tested/manual-checked.
- [ ] Dates, durations, rates, counts, identifiers, and status values use centralized safe formatting without inventing a currency or displaying invalid values.
- [ ] The UI is responsive for desktop/tablet, uses semantic accessible HTML, supports keyboard/focus navigation, meets the project’s contrast expectations, and does not rely on color alone.
- [ ] `OperationsDashboard` and route shells remain orchestration/composition-focused; fetching, mapping, status/copy/config, formatting, state, and reusable UI are extracted into focused modules.
- [ ] Existing Vitest/react-dom/tooling is used where possible without forcing a new test framework, and the post-phase gate passes.
- [ ] The implementation report includes changed files, checks/results, limitations, the planning/spec baseline hash separately, the actual 4C phase hash, and the commit message. A failed/blocking gate prevents the 4C commit and Phase 4D; continuation depends only on the automatic gate PASS and same-run phase hash.

## Handoff to `@coder-heavy`

The executor receives a clean baseline whose prior/base commit already contains the single planning commit fixing all five Phase 4 specs. Record that planning/spec hash separately; it is not a 4C or inter-phase implementation commit. Entry to 4C is gated only by the observed 4B phase hash and its automatic PASS.

Implement Phase 4C as the third stage of the single autonomous Phase 4 run, only after the 4B automatic gate PASS and observed 4B phase commit/hash, and only within this exact allowlist: `app/operations/page.tsx`, `app/operations/calls/[callId]/page.tsx`, `src/operations/ui/**`, `src/operations/client/operations-api.ts`, `src/operations/model/**`, `src/operations/lib/**`, one local CSS module, and `tests/operations/ui/**`. Treat Phase 4A/4B contracts and backend predicates as authoritative. `@coder-heavy` must not modify TCP/TMS, adapters, APIs, auth implementation, config, mock state, or production booking; do not skip or reorder phases. The planner performs only the initial handoff and does not implement product code or approve between phases. After this post-phase gate PASS, create the separate 4C implementation commit and record its actual phase hash, then continue automatically to final phase 4D in the same run. Stop and report immediately if the existing read-only contract is insufficient, if a browser credential would be required, if raw/sensitive data cannot be sanitized at the boundary, if a requirement cannot be verified, or if any proposed change makes real `LOAD_BOOK` reachable. A failed gate is **BLOCKED**: do not create the phase commit, do not claim readiness, and do not proceed to Phase 4D.
