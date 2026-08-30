# Integration status

| Component | Scope | Owner | Status | Blocker | Evidence / next action |
|---|---|---|---|---|---|
| Web Call | Capture conversation and handoff fields | HappyRobot App | IMPLEMENTED — NOT CURRENTLY VERIFIED | External provider/dependency smoke and full business-capability evidence not recorded | User-confirmed App/adapter connection; run non-mutating provider smoke test |
| Inbound Voice Agent | Orchestrate voice workflow | HappyRobot App | IMPLEMENTED — NOT CURRENTLY VERIFIED | External provider/dependency smoke and full business-capability evidence not recorded | User-confirmed App/adapter connection; run non-mutating provider smoke test |
| FMCSA | Direct App request for carrier validation; adapter consumes trusted proof only | HappyRobot App; not the TMS adapter | IMPLEMENTED — NOT CURRENTLY VERIFIED | No successful verifiable FMCSA result was captured for MC 872144; controlled real process remains blocked. MC validity is not determined. | Confirm/record a fresh, identity-bound result and audit trail |
| OTP | Deliver/verify SMS or email OTP | HappyRobot App / organization | BLOCKED — ORGANIZATION/ENVIRONMENT | Delivery unavailable | Provision provider |
| LOAD_QUERY | Search loads | TMS adapter | VERIFIED — LIMITED REAL READ-ONLY SMOKE | Point-in-time sample only; not exhaustive real endpoint verification | Local mock plus Railway smoke recorded; expand approved non-mutating coverage |
| LOAD_GET | Retrieve load | TMS adapter | VERIFIED — LIMITED REAL READ-ONLY SMOKE | Point-in-time sample only; no exhaustive coverage or production-readiness claim | Local mock plus Railway smoke recorded; expand approved non-mutating coverage |
| LOAD_BOOK | Book load | TMS adapter guard / TMS | VERIFIED — LOCAL MOCK; real path: disabled | Real path disabled; never executed | Keep disabled pending approval |
| HappyRobot App / HTTP integration | Send call record/handoff | HappyRobot App + TMS adapter boundary | IMPLEMENTED — NOT CURRENTLY VERIFIED | External end-to-end capability not verified; mapping questions provisional | User-confirmed connection; validate App and run non-mutating smoke test |
| Twin | Operational data layer | HappyRobot organization | BLOCKED — ORGANIZATION/ENVIRONMENT | Twin unavailable; DB quota exceeded | Resolve quota |
| Operational UI | Show sanitized projection | Adapter repository | IMPLEMENTED — NOT CURRENTLY VERIFIED | In-memory and non-persistent | Define durable store |
| Railway | Build, serve, healthcheck | Deployment environment | IMPLEMENTED — NOT CURRENTLY VERIFIED | Point-in-time external evidence; public URL and exhaustive behavior not recorded | Expand health/auth/read-only smoke tests |
| Docker | Build production image | Repository build/deployment | IMPLEMENTED — NOT CURRENTLY VERIFIED | Not externally verified | Build and smoke test |
| Security guards | Auth, validation, booking guard | TMS adapter | VERIFIED — LOCAL MOCK | External deployment unassessed | Repeat after deployment |
