# Integration status

| Component | Expected behavior | Current status | Evidence | Known limitation | Next action |
|---|---|---|---|---|---|
| Web Call | Capture conversation and handoff fields | IMPLEMENTED — NOT CURRENTLY VERIFIED | HappyRobot App and adapter connection user-confirmed | External provider/dependency smoke and full business-capability evidence not recorded | Run non-mutating provider smoke test |
| Inbound Voice Agent | Orchestrate voice workflow | IMPLEMENTED — NOT CURRENTLY VERIFIED | HappyRobot App and adapter connection user-confirmed | External provider/dependency smoke and full business-capability evidence not recorded | Run non-mutating provider smoke test |
| FMCSA | Verify carrier | OUT OF SCOPE | Product context | No live provider | Confirm API and consent |
| OTP | Deliver/verify SMS or email OTP | BLOCKED — ORGANIZATION/ENVIRONMENT | User status | Delivery unavailable | Provision provider |
| LOAD_QUERY | Search loads | IMPLEMENTED — CURRENTLY UNDER INVESTIGATION | Local mock tests/code | No real endpoint evidence | Capture approved read-only evidence |
| LOAD_GET | Retrieve load | IMPLEMENTED — CURRENTLY UNDER INVESTIGATION | Local mock tests/code | No approved real LOAD_ID | Obtain ID and probe |
| LOAD_BOOK | Book load | VERIFIED — LOCAL MOCK; real path: NOT IMPLEMENTED | Local mock tests; real mode 403 guard | Real path disabled; never executed | Keep disabled pending approval |
| HappyRobot App / HTTP integration | Send call record/handoff | IMPLEMENTED — NOT CURRENTLY VERIFIED | User-confirmed complete/deployed/connected; provider/dependency smoke evidence not recorded | External end-to-end capability not verified; remaining contract/mapping questions are provisional | Validate connected App and run non-mutating smoke test |
| Twin | Operational data layer | BLOCKED — ORGANIZATION/ENVIRONMENT | DB quota exceeded | Twin unavailable | Resolve quota |
| Operational UI | Show sanitized projection | IMPLEMENTED — NOT CURRENTLY VERIFIED | Local UI/API/fixtures | In-memory and non-persistent | Define durable store |
| Railway | Build, serve, healthcheck | IMPLEMENTED — NOT CURRENTLY VERIFIED | User-confirmed deployment; no external smoke evidence recorded | Public URL and external behavior are not recorded | Validate deployed service with health/auth/read-only smoke tests |
| Docker | Build production image | IMPLEMENTED — NOT CURRENTLY VERIFIED | Multi-stage Dockerfile | Not externally verified | Build and smoke test |
| Security guards | Auth, validation, booking guard | VERIFIED — LOCAL MOCK | Local tests | External deployment unassessed | Repeat after deployment |
