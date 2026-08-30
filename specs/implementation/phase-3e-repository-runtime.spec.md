# Phase 3E — Repository Runtime Specification

**Status:** **IMPLEMENTED — REPOSITORY-ONLY / RAILWAY NOT CONFIGURED**

## Context and boundary

Phase 3D is closed as local mock-safe/default-deny. This slice covers only runtime behavior implementable and verifiable in the repository. It does not make the project Railway-ready, sandbox-ready, or production-enabled, and it does not authorize TMS access or `LOAD_BOOK`.

The repository uses Next 16, React 19, TypeScript 5, and Vitest. The local contract is `npm run build` followed by `npm run start`; the default test suite excludes `tests/tms/real/**`. No Railway configuration, credentials, domains, certificates, or external networking are repository inputs.

## Scope

- Provide a minimal `GET /api/health` liveness response with stable JSON and no external IO.
- Keep readiness internal, typed, bounded, and incapable of probing or mutating TMS.
- Read runtime safety values through a server-only, immutable snapshot with mock/default-deny behavior.
- Provide idempotent cleanup for resources explicitly owned by the process, without adding a parallel server.
- Preserve existing timeout/resource limits, no-retry behavior, and real-booking denial.
- Verify build/start and runtime boundaries using local tests and mock-only execution.

## Non-goals

Railway provisioning/configuration, domains/HTTPS, platform health checks, secrets, networking/egress, TMS credentials or endpoints, real TMS operations, `LOAD_BOOK`, and sandbox/production approval are explicitly out of scope.

## Files / modules

- `app/api/health/route.ts` — thin Node.js route exposing liveness and safe method rejection.
- `src/runtime/health-contract.ts` — stable JSON payloads, status codes, headers, and public messages; no env or IO.
- `src/runtime/readiness.ts` — closed internal readiness result and bounded local-state checks; no sockets/TMS.
- `src/runtime/environment.ts` — server-only typed environment snapshot and safe validation; never serializes values.
- `src/runtime/lifecycle.ts` — registration and idempotent bounded cleanup of owned resources only.
- `src/runtime/constants.ts` — named runtime limits, timeout, and route constants.
- `tests/runtime/health.test.ts` — liveness and unsupported-method contract.
- `tests/runtime/readiness.test.ts` — pure readiness states and resource bounds.
- `tests/runtime/environment.test.ts` — mock default, invalid values, and booking flag denial.
- `tests/runtime/lifecycle.test.ts` — ownership, reverse-order cleanup, idempotency, and close failures.
- `tests/runtime/runtime-contract.test.ts` — build/start scripts, default-test exclusion, and no external health reachability.

## Module boundaries and contracts

- `GET /api/health` returns `200`, JSON `{ "status": "ok" }`, `Cache-Control: no-store`, and no mode, secret, target, port, readiness, or TMS details.
- Unsupported methods return `405`, JSON `{ error: { code, message } }`, and `Allow: GET`; they do not evaluate readiness or perform IO.
- Readiness returns only `ready` or `not-ready` with a closed non-sensitive reason. It never connects, writes, mutates, or probes TMS and is not publicly exposed in this slice.
- Runtime environment values are server-only. Routes never read raw `process.env`, `NEXT_PUBLIC_*`, headers, query, or body values for security decisions. Invalid adapter mode or any `REAL_BOOKING_ENABLED` value other than absent/exact `false` fails closed.
- Lifecycle closes only registered owned resources, is safe on duplicate close, uses bounded cleanup, and swallows private close failures rather than exposing them.
- Health is liveness, not readiness or provider availability. A successful health response is not deployment or production evidence.
- No new runtime module imports TMS client, direct transport, booking capability, controlled booking, booking ledger, or `LOAD_BOOK`.

## Technical approach and extraction

Keep HTTP orchestration, payload mapping, environment validation, readiness policy, lifecycle side effects, and constants in separate modules. Reuse existing TMS/config/deadline/resource seams rather than duplicating policy. Do not add a custom server or platform dependency solely for health. Register only resources whose creation is owned by the process; existing per-request socket cleanup remains governed by the TMS client.

## Implementation record — 2026-08-29

The repository-only runtime slice is implemented in `src/runtime/`, with the liveness route in `app/api/health/route.ts` and local coverage in `tests/runtime/`. It adds no Railway configuration, credentials, external networking, TMS probes, or booking enable path.

## Edge cases and safety

- Missing, blank, malformed, or unsafe environment values fail closed without returning values.
- TMS outage, DNS failure, timeout, missing token, or unavailable socket is never probed by health; readiness reports only a generic internal state.
- Concurrent health during startup/shutdown remains bounded and does not claim readiness.
- Repeated signals/cleanup and close failures are idempotent and non-public.
- Unexpected health errors map to generic JSON without stacks, secrets, targets, tokens, or raw messages.

## Verification

All verification is local and mock-only. Do not run `tests/tms/real/**` or `test:real-tms:*` scripts.

- Health, readiness, environment, lifecycle, runtime contract, no external reachability, and leakage tests pass.
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run start` smoke check against localhost `/api/health`
- `git diff --check`

## Rollback

Revert only the 3E runtime files and tests if a check fails, restoring the existing Next process and 3D default-deny behavior. If health or readiness reaches external IO or leaks data, remove that path rather than adding diagnostic fallback. Never relax 3D controls to make build/start/tests pass.

## Acceptance criteria

- [x] Build/start remains the existing Next 16 local contract and needs no Railway or real credentials.
- [x] Liveness is minimal, stable JSON, safe, and external-IO-free.
- [x] Readiness is internal, bounded, server-only, and TMS-free.
- [x] Environment, health, readiness, lifecycle, limits, and policy remain independently testable.
- [x] Cleanup is idempotent and affects only owned resources.
- [x] Default tests exclude real runners and cover no external reachability/leakage.
- [x] Typecheck, lint, full tests, build, diff check, and localhost health smoke pass.
- [x] Real booking remains denied; local checks do not claim Railway-ready, sandbox-ready, or production-enabled.

## Handoff boundary

Railway provisioning, platform health checks, external secrets, domains/HTTPS, networking/egress, remote deployment, TMS connectivity, `LOAD_BOOK`, and sandbox/production approval require a separate human-approved platform phase.
