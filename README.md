# HappyRobot LTMS Adapter — Phase 1C

This repository contains the first, minimal vertical slice of the carrier-sales TMS adapter:

```text
HTTP Route Handler → node:net → local LTMS mock
```

Phase 1C keeps the `DEBUG_ECHO` and read-only load slices and adds stateful `LOAD_BOOK`. Comprehensive fault injection, HappyRobot, FMCSA, the real TMS, persistence and deployment remain out of scope.

## Requirements

- Node.js 22+ recommended
- npm

## Install and configure

```bash
npm install
Copy-Item .env.example .env.local
```

The TMS settings are server-only: `TMS_HOST`, `TMS_PORT`, `TMS_AUTH_TOKEN`, `TMS_CONNECT_TIMEOUT_MS`, `TMS_RESPONSE_TIMEOUT_MS` and optional `TMS_MAX_FRAME_BYTES` (default `4096`). Never use `NEXT_PUBLIC_` for them.

## Run locally

Terminal 1:

```bash
npm run mock:tms
```

Terminal 2:

```bash
npm run dev
```

Then:

```bash
curl -X POST http://localhost:3000/api/tms/echo `
  -H "content-type: application/json" `
  -d '{"message":"hello"}'
```

Expected shape:

```json
{"ok":true,"data":{"message":"hello","fieldCount":3}}
```

## Read-only loads

Search requires at least one filter. Supported filters are `originState`, `destinationState`, `originCity`, `destinationCity` and `equipmentType`; `maxResults` is optional and capped at 50.

```bash
curl -X POST http://localhost:3000/api/tms/loads/search `
  -H "content-type: application/json" `
  -d '{"originState":"tx","equipmentType":"dry_van","maxResults":5}'
```

Get one load by ID:

```bash
curl -X POST http://localhost:3000/api/tms/loads/detail `
  -H "content-type: application/json" `
  -d '{"loadId":"LOAD-1001"}'
```

Both endpoints return `{ "ok": true, "data": ... }` on success. The internal `MAX_BUY` field is intentionally removed before the HTTP response. ASCII padding around wire fields is trimmed; state codes and equipment types are normalized to uppercase while internal city spacing is preserved.

## Stateful booking

Book a load with the exact public fields `loadId`, `mcNumber` and `agreedRate`:

```bash
curl -X POST http://localhost:3000/api/tms/loads/book `
  -H "content-type: application/json" `
  -d '{"loadId":"LOAD-1001","mcNumber":"12345","agreedRate":2200}'
```

The mock transitions each load from `AVAILABLE` to `BOOKED`, returns a booking reference and an ISO-8601 UTC timestamp, and rejects a second booking with `409 ALREADY_BOOKED`. The mock also applies the internal `MAX_BUY` policy to reject an excessive agreed rate with `422 INVALID_RATE`; the threshold is never returned publicly.

Booking has no automatic retry. If a timeout occurs after the request was sent, the result is considered uncertain and the caller must not submit a second booking automatically.

## Tests

```bash
npm test
npm run typecheck
npm run build
```

The tests cover the request builder, incremental `Buffer` parser, multiple records, `END`/`ERR`, byte limits, timeouts, socket cleanup, new connections per request, echo/load/booking route validation, public/internal load mapping, state transitions and real local TCP integration.

## Technical decisions

- Route handlers explicitly use the Node.js runtime because TCP uses `node:net`.
- TCP is treated as a byte stream; chunks are not assumed to equal lines or responses.
- Each operation opens one socket, sends one request and closes it.
- Authentication tokens and complete wire payloads are never logged or returned.
- The transport has a small seam so a future TLS transport can be added without changing protocol parsing, but TLS is not implemented yet.

## Current limitations

This is only Phase 1C. The mock supports `DEBUG_ECHO`, read-only `LOAD_QUERY`/`LOAD_GET`, stateful `LOAD_BOOK` and basic authentication/command/field/load/booking errors. Comprehensive fault scenarios, negotiation, and the real TMS remain out of scope.
