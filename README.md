# HappyRobot LTMS Adapter — Phase 2A

This repository contains the first, minimal vertical slice of the carrier-sales TMS adapter:

```text
HTTP Route Handler → node:net → local LTMS mock
```

Phase 1A–1D remains the local baseline. Phase 2A adds an explicitly opt-in validation track for the authorized candidate TMS using `DEBUG_ECHO` only. HappyRobot, FMCSA, operational real-TMS commands, persistence and deployment remain out of scope.

## Requirements

- Node.js 22+ recommended
- npm

## Install and configure

```powershell
npm install
Copy-Item .env.example .env.local
```

The TMS settings are server-only: `TMS_HOST`, `TMS_PORT` (1–65535), `TMS_AUTH_TOKEN`, `TMS_CONNECT_TIMEOUT_MS`, `TMS_RESPONSE_TIMEOUT_MS` and optional `TMS_MAX_FRAME_BYTES` (default `4096`). Never use `NEXT_PUBLIC_` for them. The `TMS_MOCK_*` variables affect only the local mock CLI. Real mode additionally requires the exact activation triple documented below.

## Run locally

Terminal 1:

```bash
npm run mock:tms
```

Terminal 2:

```bash
npm run dev
```

Then, from PowerShell, use `Invoke-RestMethod` to avoid shell quoting differences:

```powershell
$body = @{ message = 'hello' } | ConvertTo-Json -Compress
Invoke-RestMethod 'http://localhost:3000/api/tms/echo' -Method Post -ContentType 'application/json' -Body $body
```

Expected shape:

```json
{"ok":true,"data":{"message":"hello","fieldCount":3}}
```

## Read-only loads

Search requires at least one filter. Supported filters are `originState`, `destinationState`, `originCity`, `destinationCity` and `equipmentType`; `maxResults` is optional and capped at 50.

```powershell
curl -X POST http://localhost:3000/api/tms/loads/search `
  -H "content-type: application/json" `
  -d '{"originState":"tx","equipmentType":"dry_van","maxResults":5}'
```

Get one load by ID:

```powershell
curl -X POST http://localhost:3000/api/tms/loads/detail `
  -H "content-type: application/json" `
  -d '{"loadId":"LOAD-1001"}'
```

Both endpoints return `{ "ok": true, "data": ... }` on success. The internal `MAX_BUY` field is intentionally removed before the HTTP response. ASCII padding around wire fields is trimmed; state codes and equipment types are normalized to uppercase while internal city spacing is preserved.

## Stateful booking

Book a load with the exact public fields `loadId`, `mcNumber` and `agreedRate`:

```powershell
curl -X POST http://localhost:3000/api/tms/loads/book `
  -H "content-type: application/json" `
  -d '{"loadId":"LOAD-1001","mcNumber":"12345","agreedRate":2200}'
```

The mock transitions each load from `AVAILABLE` to `BOOKED`, returns a booking reference and an ISO-8601 UTC timestamp, and rejects a second booking with `409 ALREADY_BOOKED`. The mock also applies the internal `MAX_BUY` policy to reject an excessive agreed rate with `422 INVALID_RATE`; the threshold is never returned publicly.

Booking has no automatic retry. If a timeout, connection failure or upstream `SERVER_ERROR` occurs after the request was sent, the result is considered uncertain and the caller must not submit a second booking automatically; these booking errors are exposed with `retryable: false`.

## Tests

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The tests cover the request builder, incremental `Buffer` parser, arbitrary chunk boundaries, strict CRLF framing, multiple records, `END`/`ERR`, byte limits, timeouts, socket cleanup, lifecycle races, new connections per request, echo/load/booking route validation, public/internal load mapping, state transitions, configurable fault scenarios and real local TCP integration.

## Authorized real-TMS validation (Phase 2A)

The real track is disabled by default. It may run only against the authorized candidate non-production instance and only for `DEBUG_ECHO`. `npm test` never opens a real-TMS connection.

Set the following variables in the process environment using the authorized secret channel. Do not put real values in `.env.example`, source code, reports or shared terminal output:

```text
TMS_MODE=real
TMS_ENV=non-production
TMS_REAL_ENABLED=true
TMS_HOST=<authorized host>
TMS_PORT=<authorized port>
TMS_AUTH_TOKEN=<authorized token>
TMS_CONNECT_TIMEOUT_MS=<bounded timeout>
TMS_RESPONSE_TIMEOUT_MS=<bounded timeout>
```

PowerShell:

```powershell
$env:TMS_MODE = 'real'
$env:TMS_ENV = 'non-production'
$env:TMS_REAL_ENABLED = 'true'
# Inject TMS_HOST, TMS_PORT and TMS_AUTH_TOKEN through the authorized environment.
npm run test:real-tms:echo
```

Git Bash:

```bash
export TMS_MODE=real
export TMS_ENV=non-production
export TMS_REAL_ENABLED=true
# Inject TMS_HOST, TMS_PORT and TMS_AUTH_TOKEN through the authorized environment.
npm run test:real-tms:echo
```

The runner fails closed if the exact activation flags or required configuration are missing. It sends one ASCII `DEBUG_ECHO` request per connection, never retries, never runs `LOAD_QUERY`, `LOAD_GET` or `LOAD_BOOK`, and writes only sanitized metadata to `reports/tms/phase-2a/real-debug-echo.json` after a successful probe. Optional probes are disabled by default:

```powershell
$env:TMS_REAL_ECHO_EXTRAS = 'true'        # also probes X/Y/Z and expects FIELDS_PARSED=6
$env:TMS_REAL_ECHO_AUTH_INVALID = 'true' # only when explicitly authorized
```

The real TMS handbook is `HR-LTMS-PR-001`. Its successful response uses the marker `ECHO` and fields `AUTH:OK`, `FIELDS_PARSED` and `MSG`; the public API continues returning only `{ message, fieldCount }`. A successful `DEBUG_ECHO` validates transport, authentication and parsing only. It does not validate operational commands or real fault injection.

## Technical decisions

- Route handlers explicitly use the Node.js runtime because TCP uses `node:net`.
- TCP is treated as a byte stream; chunks are not assumed to equal lines or responses.
- Each operation opens one socket, sends one request and closes it.
- Authentication tokens and complete wire payloads are never logged or returned.
- The transport has a small seam so a future `node:tls` transport can be added without changing protocol parsing, but TLS is not implemented yet.
- Parser diagnostics are bounded and redact sensitive fields such as `AUTH`, `TOKEN`, `MAX_BUY` and `NOTES`; HTTP errors expose stable public messages only.
- Singular operations validate their upstream response shape: echo, detail and booking require exactly one valid record. Malformed upstream records are reported as HTTP `502`, not as caller validation errors.
- A response is complete only after `END\r\n` and the peer's TCP close; this lets the client reject bytes that arrive after the terminal frame.

## Fault injection

The mock accepts deterministic scenarios through `createMockLtmsServer` options or environment variables used by `npm run mock:tms`:

| Scenario | Behavior |
| --- | --- |
| `none` | Normal response (default) |
| `no-response` | Keeps the connection open until the client response timeout |
| `partial-without-end` | Sends a record and closes without `END` |
| `malformed` | Sends an invalid response record |
| `invalid-framing` | Sends isolated LF framing |
| `delayed-end` | Sends records and delays `END` (`TMS_MOCK_DELAY_MS`) |
| `fragmented` | Sends the response in small chunks (`TMS_MOCK_FRAGMENT_SIZE`) |
| `server-error` | Sends `ERR|CODE:SERVER_ERROR` |
| custom remote code | Set `TMS_MOCK_SCENARIO=AUTH_FAILED`, for example |

Example in PowerShell:

```powershell
$env:TMS_MOCK_SCENARIO = 'fragmented'
$env:TMS_MOCK_FRAGMENT_SIZE = '1'
npm run mock:tms
```

Stop the mock with `Ctrl+C` and restart it to reset its isolated booking state.

## Current limitations

The local mock supports `DEBUG_ECHO`, read-only `LOAD_QUERY`/`LOAD_GET`, stateful `LOAD_BOOK`, remote error codes and deterministic fault scenarios. Phase 2A only adds an opt-in real `DEBUG_ECHO` runner. TLS, negotiation, real operational commands, FMCSA, HappyRobot, persistence and deployment remain out of scope.
