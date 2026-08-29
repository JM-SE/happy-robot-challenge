# Phase 3 — HTTP Integration and Mock-Safe TMS Adapter Phase Index Specification

## Context

Phase 1 is complete. Phase 2 is committed as `048ae3f` and closed for its safety gates. The adapter has never executed a real TMS operation or real `LOAD_BOOK`; both remain disabled until a later, separately approved Phase 3 follow-up. This phase index must not be read as authorization for a production booking path.

The goal of Phase 3 is to make the adapter safely consumable by HappyRobot through a stable HTTP contract and deterministic mock workflow while preserving the mature Phase 1/2 foundations. It adds a thin HTTP boundary around the TCP protocol, parser, transport, deadline, limits, resource controls, policy, mock, and controlled-workflow code; it does not rewrite them. Phase 3A and 3B are implemented and committed at `8b77734` and `73205d4`; 3C is implemented locally, with commit status not asserted here. 3D is closed as **CLOSED — LOCAL MOCK-SAFE / REAL BOOKING DISABLED**, with local mock-safe criteria demonstrated. This closure does not enable real booking, make the adapter sandbox-ready, or make it production-enabled.

### Responsibility boundary

- **HappyRobot owns:** voice, FMCSA, OTP, negotiation, handoff, extraction, and Twin.
- **Adapter owns:** HTTP authentication and validation, TCP translation/parsing, normalized responses/errors, deterministic mock behavior, real-booking protection, and safe correlation/logging.
- **Explicit non-goals:** FMCSA implementation, OTP providers, voice, Twin, SDK, OAuth/accounts/payments/dashboard, and production real `LOAD_BOOK`.

## Requirements

### Invariants

- [ ] Phase 1/2 protocol and safety behavior remains available through existing internal seams; HTTP adapters stay thin.
- [ ] All public TMS endpoints are authenticated, bounded, correlated, and JSON-only; health is a separate later boundary.
- [ ] `ADAPTER_MODE=mock` is the safe default. Real TMS read-only use, if retained, cannot imply real booking authority.
- [ ] Public booking is default-deny until the explicitly scoped mock-demo phase is complete; real booking remains unavailable throughout 3A–3C.
- [ ] No client request, query parameter, header, body field, or client-controlled environment value can enable real mode or real booking.
- [ ] Secrets, raw TCP frames/lines, stacks, `MAX_BUY`, internal pricing, MC values, and full/raw/sensitive notes do not cross public responses, examples, reports, or logs.
- [ ] Any future real booking continues to preserve one-shot/write-disposition, no-retry, `rollbackAvailable=false`, evidence, target, authority, and approval gates from Phase 2.

### Sequencing and dependencies

1. Phase 2 baseline, tests, and historical evidence remain intact; no real TMS or `LOAD_BOOK` execution is a dependency of local work.
2. 3A establishes the shared HTTP contract before domain expansion or demo behavior.
3. 3B depends on 3A envelopes, authentication, correlation, and validation boundaries.
4. 3C depends on 3B DTOs and uses deterministic mock-only behavior; it cannot activate a real transport.
5. 3D depends on the preceding contracts and adds configuration/security gates, not a production booking release.
6. 3E–3G consume the stabilized contracts for deployment, verification, and documentation.

## Phase Map

| Phase | Objective | Scope | Non-goal | Dependencies | Exit signal | Primary risk |
| --- | --- | --- | --- | --- | --- | --- |
| **3A — HTTP integration contract** *(implemented)* | Establish one stable authenticated JSON boundary. | Auth, request IDs, method/content-type/body limits, envelopes, safe errors, thin route orchestration for echo/search/detail/book. | Any real booking or production mutation path. | Phase 1/2 code and safety gates. | Contract tests prove authenticated read routes and safe booking denial. | Duplicated route policy or leakage at the boundary. |
| [**3B — Endpoint/domain contracts**](./phase-3b-endpoint-domain-contracts.spec.md) *(implemented)* | Finalize public DTOs and endpoint semantics. | Search/detail summaries, detail shape, booking input/output contract, normalized domain errors. | HappyRobot/FMCSA/OTP/voice/Twin implementation; real booking approval. | 3A. | DTOs are versionable, closed, and mapped to existing service/ports. | Invented fields or exposing internal load/pricing data. |
| [**3C — Deterministic mock/demo scenarios**](./phase-3c-deterministic-mock-demo.spec.md) *(implemented locally; commit status not asserted)* | Demonstrate the workflow without a provider side effect. | Mock search/detail and explicitly documented mock booking/demo scenarios, including faults and idempotent test behavior. | Treating mock success as real TMS proof; any real connection/write. | 3A, 3B, existing `mock/`. | Repeatable demo and fault matrix with zero real calls. | Mock behavior diverges from parser/transport contracts or looks production-authorized. |
| [**3D — Security/configuration and real-mode gates**](./phase-3d-security-configuration-real-mode-gates.spec.md) *(closed — local mock-safe / real booking disabled)* | Make runtime mode and future authority boundaries explicit. | Server-only adapter config, secret provisioning hooks, default-deny booking guard, target/egress/authority checks, safe logs, approval gates. | Enabling production real `LOAD_BOOK` in this phase. | 3A–3C plus Phase 2 gates. | Local criteria demonstrated; unsafe combinations fail closed and real booking remains explicitly unavailable. | Configuration or caller input bypasses a gate. |
| **3E — Railway-compatible deployment/health/runtime** | Operate the adapter safely in the intended runtime. | HTTPS deployment shape, process/runtime settings, bounded health/readiness, shutdown/cleanup, environment contract. | Health exposing TMS credentials or sensitive configuration. | Stable 3A contract and 3D config boundary. | Deployment smoke checks and health policy pass without external booking. | Health/observability or platform behavior leaks secrets or changes mode. |
| **3F — Contract/integration/security/deployment tests** | Prove behavior and non-reachability. | HTTP contract, mock integration, security/static checks, resource/deadline regression, deployment checks. | Running real TMS or real `LOAD_BOOK` as a local acceptance test. | 3A–3E. | Required suites pass; real tests remain excluded or explicitly blocked. | Green tests fail to prove absence of a booking escape hatch. |
| **3G — README/integration documentation** | Make integration use and limits durable. | Endpoint examples, auth/request-ID rules, errors, mock setup, deployment/env guidance, non-goals, approval boundary. | Publishing secrets, production credentials, or claiming real booking readiness. | 3A–3F decisions. | A new integrator can use mock-safe endpoints without undocumented assumptions. | Docs drift from the actual contract or imply production authority. |

## Phase Details

### [3A — HTTP integration contract](./phase-3a-http-integration-contract.spec.md) — implemented

- **Objective:** Provide authenticated public HTTPS JSON routes for echo, read-only load search/detail, and a safely denied booking surface with one response/error/correlation contract.
- **Scope:** `POST /api/tms/echo`, `POST /api/tms/loads/search`, `POST /api/tms/loads/detail`, and `POST /api/tms/loads/book`; shared API-key auth, bounded JSON, request IDs, normalized envelopes/statuses, and safe logs. An unauthenticated `GET /api/health` is optional and deferred to 3E.
- **Non-goals:** Any real TMS booking, production mutation, new business workflow, or implementation of HappyRobot-owned systems.
- **Dependencies:** Existing TMS service/client/parser/transport/limits and the closed Phase 2 default-deny safety posture.
- **Deliverables:** Modular shared HTTP contract/auth/context helpers, route-local DTO validation, thin route orchestration, server-only adapter configuration extension, and focused contract tests. Detailed execution requirements are in the dedicated 3A spec.
- **Acceptance/exit criteria:** Authenticated read routes return stable envelopes with request IDs; invalid method/content type/body/auth is bounded and safe; booking shape is validated but mutation is denied before upstream access; real mode returns stable `REAL_BOOKING_DISABLED`; no secret/raw-wire/internal-field leakage.
- **Risks:** Auth added inconsistently, TMS `AUTH_FAILED` confused with adapter auth, or a route reaches the isolated booking seam.

### [3B — Endpoint/domain contracts](./phase-3b-endpoint-domain-contracts.spec.md) — implemented

- **Objective:** Lock the public search/detail/book DTOs and behavior after the transport-independent HTTP boundary exists.
- **Scope:** Closed request/response schemas, public load summary/detail allowlists, normalized domain error codes, and the mock-booking contract that 3C will exercise.
- **Non-goals:** Real provider authority, negotiation/FMCSA handoffs, or production `LOAD_BOOK`.
- **Dependencies:** 3A envelopes/auth/context and existing `src/tms/service.ts` read-only seam.
- **Deliverables:** Versioned DTO/schema definitions, mapping rules, field-level sensitivity decisions, and examples containing no secrets or operational identifiers.
- **Acceptance/exit criteria:** Inputs use only approved names; no date field or other invented domain field is introduced; internal fields such as `MAX_BUY` cannot be represented publicly; booking remains mock-only or denied.
- **Risks:** Public DTOs accidentally mirror internal records or create a reusable real-booking port.

### [3C — Deterministic mock/demo scenarios](./phase-3c-deterministic-mock-demo.spec.md) — implemented locally; commit status not asserted

- **Objective:** Give HappyRobot/integration reviewers a repeatable demo without real authority or side effects.
- **Scope:** Existing mock dataset/server and fault scenarios, explicit mock mode, deterministic search/detail, and a separately labeled mock booking demo if 3B approves it.
- **Non-goals:** Real TMS connectivity, real evidence, production-like approval, or a public route that can be mistaken for real booking.
- **Dependencies:** 3A and 3B plus fragmented/delayed/timeout/cleanup behavior already covered by the mock and client seams.
- **Deliverables:** Scenario matrix, demo-safe fixtures, and tests proving no real transport or real capability is reachable.
- **Acceptance/exit criteria:** Repeated runs produce the same normalized outcomes; faults remain bounded; mock success is labeled mock and cannot enable `LOAD_BOOK` real mode.
- **Risks:** Mock drift, state leakage between runs, or a demo path becoming an escape hatch.

### [3D — Security/configuration and real-mode gates](./phase-3d-security-configuration-real-mode-gates.spec.md) — **CLOSED — LOCAL MOCK-SAFE / REAL BOOKING DISABLED**

- **Objective:** Centralize server-only configuration and preserve fail-closed real-booking protection.
- **Scope:** `ADAPTER_MODE`, `ADAPTER_SHARED_SECRET`, `REAL_BOOKING_ENABLED`, existing TMS configuration, secret rotation/provisioning boundary, independent authority/target/egress inputs, and allowlisted logging.
- **Non-goals:** Final production approval or execution of real `LOAD_BOOK`.
- **Dependencies:** 3A–3C and Phase 2 target, transport, caller, capability, ledger, deadline, and evidence gates.
- **Deliverables:** Configuration contract, unsafe-combination matrix, default-deny guard, and operational approval checklist.
- **Acceptance/exit criteria:** Local criteria are demonstrated: mock is the default; unsafe combinations fail closed; no request/header/env client input enables real booking; real mode remains unavailable for booking. This closure does not make the adapter sandbox-ready or production-enabled; any real booking requires a separately approved follow-up.
- **Risks:** Secret/config authority confusion, insecure deployment defaults, or accidental production activation.

### 3E — Railway-compatible deployment/health/runtime

- **Objective:** Run the adapter with bounded startup, health, shutdown, and environment behavior on Railway-compatible infrastructure.
- **Scope:** HTTPS termination assumption, start/build/runtime contract, optional health endpoint, readiness semantics, graceful cleanup, and safe observability retention.
- **Non-goals:** Health checks that probe or mutate the real TMS, or platform-specific credentials in source/docs.
- **Dependencies:** 3A contract and 3D configuration policy; exact health exposure and domain policy remain open questions.
- **Deliverables:** Deployment settings/steps documented in the later implementation phase, health contract, and smoke checks.
- **Acceptance/exit criteria:** Deployment does not log secrets, accepts only intended server env, health reveals no sensitive config, and mock-safe runtime is demonstrable.
- **Risks:** Platform env behavior, public health exposure, or logs retained longer than approved.

### 3F — Contract/integration/security/deployment tests

- **Objective:** Verify both positive HTTP behavior and negative reachability guarantees.
- **Scope:** Auth, correlation, validation, status/envelope mapping, mock integration/faults, static import/escape-hatch checks, deployment/health checks, and regression of Phase 1/2 primitives.
- **Non-goals:** Calling a real TMS or real `LOAD_BOOK` to make tests pass.
- **Dependencies:** 3A–3E.
- **Deliverables:** Focused contract suite plus full existing typecheck/lint/test/build/diff checks.
- **Acceptance/exit criteria:** Required local checks pass; unauthorized and disabled paths make no upstream request; tests cannot activate real mode or leak protected data.
- **Risks:** Tests mock away the boundary, omit streaming/timeout cases, or accidentally include a real runner.

### 3G — README/integration documentation

- **Objective:** Make the adapter contract consumable without private context.
- **Scope:** Routes, exact request names, envelopes/errors, auth/request IDs, mock startup/demo, env names, health/deployment notes, non-goals, and real-booking approval boundary.
- **Non-goals:** Credentials, raw protocol dumps, operational IDs, or claims of production real-booking readiness.
- **Dependencies:** Final 3A–3F contracts and verification results.
- **Deliverables:** README/integration section and sanitized examples.
- **Acceptance/exit criteria:** Documentation matches tested behavior, states mock/default-deny limits, and distinguishes adapter auth from TMS auth.
- **Risks:** Stale examples, invented fields, or unsafe copy/paste configuration.

## Technical Approach

Use a layered adapter: request method/content-type/size → request ID context → adapter API-key auth → bounded JSON/DTO validation → existing service/client or mock port → allowlisted public mapping → stable envelope and sanitized log. Keep HTTP policy separate from TCP protocol and domain rules. Keep the isolated booking capability/workflow private and unreachable from 3A public orchestration.

## Recommended Implementation Order

1. Auth and correlation.
2. Search.
3. Detail.
4. Mock booking/demo behavior.
5. Real-booking guard and explicit unavailable response.
6. Deployment/runtime/health.
7. Contract, integration, security, and deployment tests.
8. README/integration documentation.
9. Full verification and independent safety review.

The order does not authorize real booking: step 4 is mock-only, and step 5 strengthens the default-deny boundary before any later authority/approval work.

## Risk and Closure Rules

- Preserve Phase 1/2 parser, transport, deadlines, limits, resource cleanup, policy, mock, and controlled-workflow behavior; extend with adapters rather than rewrite.
- Stop and classify the work as **BLOCKED** if a dependency would make real `LOAD_BOOK` reachable without the later authority, target/egress, trusted-caller, durable one-shot, evidence, and explicit approval gates.
- Do not use local green tests, mock booking, a health response, or a successful read as real-provider or side-effect proof.
- Never retry booking, clear an uncertain attempt, simulate rollback, or change `rollbackAvailable=false`.

### Phase 3 closure rule

Phase 3 may close its initial mock-safe scope only when authenticated public read endpoints, a deterministic mock booking demo, real booking default-deny/explicit unavailable behavior, no secret/raw-payload leakage, and the required tests/docs/deployment checks are complete. Real provider access, authority, side-effect proof, and final production approval remain a Phase 3 follow-up/production-approval concern.

## Open Questions

These are non-blocking for the initial mock-safe implementation unless a decision would weaken a security invariant:

- What exact HappyRobot production header name/rotation process and secret provisioning mechanism will be used? **Recommend retaining `X-Adapter-API-Key` and server-only `ADAPTER_SHARED_SECRET` until confirmed.**
- Should the public API use a version prefix such as `/api/v1/tms`? **Recommend no prefix for 3A to preserve the requested routes; add a version only as an explicit compatibility decision.**
- Should `/api/health` be public, private, or platform-network-only? **Recommend a minimal unauthenticated liveness response in 3E, with readiness/config details private.**
- What deployment domain and observability/log-retention policy apply on Railway? **Recommend no secrets or payloads and the shortest approved retention by default.**
- Who provides final production real-booking approval and what evidence is authoritative? **Recommend a separate named approval and evidence checklist after all gates; it is not a 3A–3C dependency.**
