# HappyRobot LTMS Adapter

Next.js HTTP adapter for a carrier-sales workflow. It provides a narrow authenticated boundary to a local deterministic TMS mock and a guarded server-only TCP read path.

**Current status:** local mock behavior is **VERIFIED — LOCAL MOCK**. The HappyRobot App is deployed/complete and connected to the adapter by user confirmation; the authenticated handoff and real read-only adapter behavior remain **IMPLEMENTED — NOT CURRENTLY VERIFIED** where external smoke evidence is absent. Railway deployment exists by user confirmation as a hosting workaround because HappyRobot infrastructure could not host the app; no public URL or external smoke-test evidence is recorded. Real booking is disabled; real `LOAD_BOOK` was never executed.

Documentation: [build description](docs/build-description.md) · [integration status](docs/integration-status.md) · [API contract](docs/api-contract.md) · [limitations](docs/limitations.md) · [Railway](docs/deployment/railway.md) · [build description and QA report](docs/deliverables/build-description-and-qa-report.md)

## Architecture and responsibilities

```text
HappyRobot App (implemented and connected; limitations apply)
  → authenticated HTTP handoff
  → Railway-hosted Next.js adapter
  → local mock or guarded node:net TMS client
```

HappyRobot is expected to own voice/call orchestration, carrier/FMCSA/OTP/negotiation handoffs, and a call-record webhook. The adapter owns authentication, closed request validation, TCP framing, safe mapping, error envelopes, safety guards, and liveness. The Operations UI is a temporary process-local in-memory projection.

The internal protocol is a TCP byte stream with CRLF framing, `END` plus peer-close completion, one socket per request, and `DEBUG_ECHO`, `LOAD_QUERY`, `LOAD_GET`, and `LOAD_BOOK` commands. Tokens and wire payloads are server-only. TLS is not implemented.

## Local setup

Requirements: Node.js 22+ and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run mock:tms
# in another terminal
npm run dev
```

All values in `.env.example` are server-only; never use `NEXT_PUBLIC_*`. Mock mode is the default (`ADAPTER_MODE=mock`).

## Environment variables

The actual names in `.env.example` are: `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN`, `TMS_CONNECT_TIMEOUT_MS`, `TMS_RESPONSE_TIMEOUT_MS`, `TMS_MAX_FRAME_BYTES`, `ADAPTER_MODE`, `ADAPTER_SHARED_SECRET`, `REAL_BOOKING_ENABLED`, `TMS_MOCK_SCENARIO`, `TMS_MOCK_DELAY_MS`, and `TMS_MOCK_FRAGMENT_SIZE`. Real read-only validation additionally uses the commented, approved-control names `TMS_MODE`, `TMS_ENV`, `TMS_REAL_ENABLED`, `TMS_REAL_TARGET_PIN`, `TMS_REAL_TARGET_ALLOWLIST`, `TMS_REAL_TRANSPORT_APPROVED`, `TMS_REAL_AUTHORITY_HOST`, `TMS_REAL_AUTHORITY_PORT`, `TMS_REAL_ECHO_EXTRAS`, and `TMS_REAL_ECHO_AUTH_INVALID`.

Use `ADAPTER_MODE=mock` for local deterministic behavior. Real read-only mode is opt-in with status **IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**; it does not authorize booking. `REAL_BOOKING_ENABLED=false` is the booking guard, and real booking fails closed with `REAL_BOOKING_DISABLED` before TMS access. Never commit secrets or use `NEXT_PUBLIC_*`.

## HTTP API

All TMS routes require `POST`, `Content-Type: application/json`, and `x-adapter-api-key` matching server-only `ADAPTER_SHARED_SECRET`. TMS `GET` requests return 405 with `Allow: POST`. Request IDs are returned in `meta.requestId` and `x-request-id`.

| Method | Path                    | Request                                                              |
| ------ | ----------------------- | -------------------------------------------------------------------- |
| POST   | `/api/tms/echo`         | exact `{message:string}`                                             |
| POST   | `/api/tms/loads/search` | `originState?`, `destinationState?`, `equipmentType?`, `maxResults?` |
| POST   | `/api/tms/loads/detail` | exact `{loadId:string}`                                              |
| POST   | `/api/tms/loads/book`   | exact `{loadId,mc,agreedRate}`                                       |
| GET    | `/api/health`           | unauthenticated liveness                                             |

Search requires one filter, accepts no city/ZIP HTTP keys, uppercases states/equipment, and defaults `maxResults` to 10 (range 1–50). Detail IDs are max 64 characters. Booking rates are finite, positive, ≤1,000,000, and max two decimals; `mc` is max 64 characters. `mcNumber` is outdated documentation; `mc` is authoritative.

Success: `{ok:true,data,meta:{requestId}}`. Adapter errors: `{ok:false,error:{code,message,retryable},meta:{requestId}}`. Health differs: `{status:"ok"}` with `Cache-Control: no-store`; POST/OPTIONS return 405. See the [full contract](docs/api-contract.md).

Public loads contain `loadId`, origin/destination states and cities, `equipmentType`, `rate`, and optional `pickupDate`, `miles`, and `status`. Pickup-date business semantics are unspecified. Private notes, raw wire data, tokens, and internal purchase-limit policy details are never public. The internal purchase ceiling is enforced server-side and omitted from responses, logs, and documentation.

## Modes and booking

Mock booking may return a deterministic `{booking:{bookingRef,loadId,agreedRate,bookedAt,mode:"mock",demo:true}}` result without opening TCP. Real mode fails closed with HTTP 403 `REAL_BOOKING_DISABLED` before any booking port or TMS access. Real `LOAD_BOOK` has never been executed and no approved real `LOAD_ID` exists.

The real read-only adapter path exists behind approved controls, but current endpoint behavior is **IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**; local route-composition tests using a mock TCP server are not real-TMS verification. **Known unresolved endpoint issue: real `LOAD_QUERY`/`LOAD_GET` behavior is not verified and no approved real `LOAD_ID` exists.**

## Health, readiness, and security

`GET /api/health` is liveness only; it does not prove TMS, HappyRobot, or Railway readiness. Readiness is an internal pure evaluator with invalid-environment, shutting-down, and resource-limit reasons. Never put secrets, MC data, rates, IDs, or handoff payloads in source, URLs, browser variables, reports, or logs.

## Docker, Railway, and provisional HappyRobot handoff

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Current evidence is 46 test files and 310 passing tests, plus passing typecheck/lint/build/security and zero-reachability checks. Deployment/integration smoke tests were not run or are not evidenced. Docker uses a Node 22 Alpine multi-stage build and a dynamic Railway `PORT`; `railway.json` uses `/api/health`. Railway deployment exists by user confirmation as a hosting workaround because HappyRobot infrastructure could not host the app. Use literal `<ADAPTER_BASE_URL>` for webhook and smoke-test instructions in [Railway](docs/deployment/railway.md).

Docker usage: `docker build -t happyrobot-ltms-adapter .` then `docker run --rm -p 3000:3000 --env-file .env.local happyrobot-ltms-adapter`. Railway uses the Dockerfile builder; see the [Railway handoff](docs/deployment/railway.md) for provisional setup.

HappyRobot App integration is user-confirmed complete and connected; Web Call and Inbound Voice Agent are **IMPLEMENTED — NOT CURRENTLY VERIFIED** because external provider/dependency smoke evidence remains unrecorded. Configure or validate webhook behavior only against the approved contract, using the literal `<ADAPTER_BASE_URL>` and a non-mutating smoke test. OTP delivery is unavailable; Twin is unavailable because organization DB quota was exceeded; FMCSA is out of scope/not live; real TMS endpoint behavior remains under investigation; real booking is disabled and there is no real-booking rollback/reconciliation procedure. The Operations UI is temporary, in-memory, and non-persistent.

No code changes were made for this documentation update.
