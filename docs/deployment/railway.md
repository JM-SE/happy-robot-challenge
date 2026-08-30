# Railway deployment handoff

## Current state

Railway deployment exists by user confirmation. Railway is used as a hosting
workaround because HappyRobot infrastructure could not host the app. External
deployment smoke-test evidence is not recorded/not run. No public URL is
included in this document.

The HappyRobot App is deployed/complete and its adapter connection is confirmed
by the user. HappyRobot provider/dependency smoke tests and full
business-capability evidence are not recorded.

## Required Railway service

The deployed service uses one Railway service from this repository, the
repository `Dockerfile`, and Railway's Dockerfile builder. No public domain or
URL is claimed.

## Build and start

The Docker build step is `npm run build` (the builder stage's `RUN npm run build`). The container start command is `node node_modules/next/dist/bin/next start --hostname 0.0.0.0`. This is equivalent in intent to `npm start`, whose package script is `next start --hostname 0.0.0.0`; Railway should use the Dockerfile command rather than assume a separate start command. Railway injects `PORT`; the image has a fallback `PORT=3000`, and the command does not hardcode the port. `HOSTNAME=0.0.0.0` is configured. `railway.json` uses `/api/health`, a 10-second timeout, and restart-on-failure with up to 3 retries.

## Environment variables and secret handling

Mock mode requires the server-only variables `ADAPTER_MODE=mock`, `ADAPTER_SHARED_SECRET`, `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN`, `TMS_CONNECT_TIMEOUT_MS`, `TMS_RESPONSE_TIMEOUT_MS`, `TMS_MAX_FRAME_BYTES` (deprecated request-frame compatibility), `TMS_MAX_RESPONSE_BYTES`, `TMS_MAX_RESPONSE_LINE_BYTES`, `TMS_MAX_RESPONSE_RECORDS`, `REAL_BOOKING_ENABLED=false`, `TMS_MOCK_SCENARIO`, `TMS_MOCK_DELAY_MS`, and `TMS_MOCK_FRAGMENT_SIZE`. Response safety variables default to `65536`, `16384`, and `512`; they are independently capped at `1048576`, `65536`, and `4096`.

Real read-only mode additionally requires the approved, server-only controls `TMS_MODE=real`, `TMS_ENV=non-production`, `TMS_REAL_ENABLED=true`, `TMS_REAL_TARGET_PIN`, `TMS_REAL_TARGET_ALLOWLIST`, `TMS_REAL_TRANSPORT_APPROVED=true`, `TMS_REAL_AUTHORITY_HOST`, and `TMS_REAL_AUTHORITY_PORT`. It uses the same independent response safety variables and defaults above. Optional probe flags are `TMS_REAL_ECHO_EXTRAS` and `TMS_REAL_ECHO_AUTH_INVALID`. Read-only mode does not authorize booking.

Read-only/liveness deployment needs `PORT` from Railway; it is not set to a public URL. Set secrets in Railway's secret/environment-variable facility, never in source, `NEXT_PUBLIC_*`, committed files, logs, or webhook payloads. Do not invent values for placeholders or provider contracts. Keep `REAL_BOOKING_ENABLED=false`; real authority variables require approved private-network controls.

## Health and readiness

`GET <ADAPTER_BASE_URL>/api/health` is an unauthenticated liveness check returning `{ "status":"ok" }` and `Cache-Control: no-store`. It does not prove TMS, HappyRobot, or Railway readiness. Readiness expectations must be confirmed separately; do not treat this endpoint as a readiness or dependency check.

## Planned post-deployment smoke checks

Substitute the assigned private service URL for the literal placeholder:

```text
GET <ADAPTER_BASE_URL>/api/health
POST <ADAPTER_BASE_URL>/api/tms/echo
POST <ADAPTER_BASE_URL>/api/tms/loads/search
POST <ADAPTER_BASE_URL>/api/tms/loads/detail
POST <ADAPTER_BASE_URL>/api/tms/loads/book  # must remain 403 in real mode
```

Verify health/no-store, 401 auth failures, 415 content-type failures, request-ID correlation, sanitized mock reads, and booking zero-reachability. These checks are planned, not current evidence.

## HappyRobot Webhooks setup

After the payload and authentication contract are approved, validate the
connected HappyRobot App against the literal `<ADAPTER_BASE_URL>`. Use provider
variable pickers, start non-mutating, and verify sanitized records and failure
handling. The App connection is user-confirmed; provider/dependency smoke
evidence remains unrecorded. Web Call and Inbound Voice Agent behavior are
**IMPLEMENTED — NOT CURRENTLY VERIFIED**. Provider/dependency smoke evidence
and full business-capability evidence remain unrecorded. Do not configure real
booking.

## Disabling and rollback

Keep real booking disabled. If the deployment is unsafe, disable the service or revert through the organization's controlled image/configuration process. Railway rollback details must follow the organization's approved procedure; no approved real-booking rollback or reconciliation procedure exists. Do not enable real booking.
