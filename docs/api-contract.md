# API contract

## Common adapter rules

The TMS adapter routes below accept `POST` only, require the `x-adapter-api-key`
header, and require a `Content-Type` beginning with `application/json`. The
header value is the server-only `ADAPTER_SHARED_SECRET`; its value is not
documented or exposed here. `GET` requests to TMS routes are rejected with
`405 METHOD_NOT_ALLOWED` (and `Allow: POST`).

Successful adapter responses are HTTP 200 and use:

```json
{"ok":true,"data":{},"meta":{"requestId":"<request-id>"}}
```

Adapter errors use the corresponding HTTP status and:

```json
{"ok":false,"error":{"code":"<CODE>","message":"<public message>","retryable":false},"meta":{"requestId":"<request-id>"}}
```

Request IDs are also returned in `x-request-id`. Public responses do not
include raw upstream details.

## Required endpoints

### Echo

#### Method

`POST`

#### Path

`/api/tms/echo`

#### Authentication header

Required: `x-adapter-api-key: <server-only shared secret>`.

#### Request schema

The body must contain exactly one field, `message`, which is non-empty bounded
text and cannot contain `|`, carriage return, or line-feed framing characters.

#### Valid example

```json
{"message":"hello"}
```

#### Invalid example

```json
{"message":"","extra":true}
```

This returns HTTP 400 `VALIDATION_ERROR`.

#### Success response and HTTP 200 status

HTTP 200 with the adapter envelope and `meta.requestId`; the echo result is in
`data`. The request ID is present in the body and `x-request-id` header.

#### Expected business error response(s) with status/code

HTTP 400 `VALIDATION_ERROR` for an invalid or unsupported request body.

#### Transport/technical error response(s) with statuses/codes

The common adapter contract applies: HTTP 401 `ADAPTER_UNAUTHORIZED`, 405
`METHOD_NOT_ALLOWED`, 413 `REQUEST_TOO_LARGE`, and 415
`UNSUPPORTED_MEDIA_TYPE`. Adapter/upstream failures map to HTTP 502
`TMS_AUTH_FAILED`, `UPSTREAM_ERROR`, or `PROTOCOL_ERROR`, HTTP 503
`CONFIGURATION_UNAVAILABLE` or `SERVICE_UNAVAILABLE`, and HTTP 504
`TMS_TIMEOUT`.

#### Sensitive fields excluded

No token, raw wire data, private notes, full MC, or internal purchase-limit
policy value/details are returned. The shared secret is never public data.

#### Mode/status

`VERIFIED — LOCAL MOCK`. Real endpoint behavior is `IMPLEMENTED — CURRENTLY
UNDER INVESTIGATION`; no approved real endpoint evidence is documented.

### Public load search

#### Method

`POST`

#### Path

`/api/tms/loads/search`

#### Authentication header

Required: `x-adapter-api-key: <server-only shared secret>`.

#### Request schema

The body may contain only `originState`, `destinationState`, `equipmentType`,
and `maxResults`. At least one of the three filters is required. States are
two letters after normalization; equipment is uppercased; `maxResults` is an
integer from 1 through 50 and defaults to 10. City and ZIP fields are not
accepted by this public HTTP endpoint, even if a lower-level parser supports
them.

#### Valid example

```json
{"originState":"tx","maxResults":2}
```

#### Invalid example

```json
{"city":"Dallas"}
```

This returns HTTP 400 `VALIDATION_ERROR`; `{"maxResults":51}` and an empty
filter object are also invalid.

#### Success response and HTTP 200 status

HTTP 200 with `data: {"loads":[...]}` and `meta.requestId`; the request ID is
also returned in `x-request-id`.

#### Expected business error response(s) with status/code

HTTP 400 `VALIDATION_ERROR` for missing filters, invalid filter values, or
unsupported fields.

#### Transport/technical error response(s) with statuses/codes

The common adapter contract applies: HTTP 401 `ADAPTER_UNAUTHORIZED`, 405
`METHOD_NOT_ALLOWED`, 413 `REQUEST_TOO_LARGE`, 415
`UNSUPPORTED_MEDIA_TYPE`, 502 `TMS_AUTH_FAILED`, `UPSTREAM_ERROR`, or
`PROTOCOL_ERROR`, 503 `CONFIGURATION_UNAVAILABLE` or `SERVICE_UNAVAILABLE`,
and 504 `TMS_TIMEOUT`.

#### Sensitive fields excluded

Public loads exclude private notes, raw wire data, tokens, full MC values, and
internal purchase-limit policy value/details. The policy value is never public
data.

#### Mode/status

`VERIFIED — LOCAL MOCK`. Real endpoint behavior is `IMPLEMENTED — CURRENTLY
UNDER INVESTIGATION`; there is no approved real evidence.

### Public load detail

#### Method

`POST`

#### Path

`/api/tms/loads/detail`

#### Authentication header

Required: `x-adapter-api-key: <server-only shared secret>`.

#### Request schema

The body must contain exactly `loadId`. It is bounded text of at most 64
characters and cannot contain `|`, carriage return, or line feed.

#### Valid example

```json
{"loadId":"LOAD-1001"}
```

#### Invalid example

```json
{}
```

This returns HTTP 400 `VALIDATION_ERROR`.

#### Success response and HTTP 200 status

HTTP 200 with `data: {"load":{...}}` and `meta.requestId`; the request ID is
also returned in `x-request-id`.

#### Expected business error response(s) with status/code

HTTP 404 `LOAD_NOT_FOUND` when the exact `loadId` is unknown. No approved real
load ID or real evidence is available.

#### Transport/technical error response(s) with statuses/codes

The common adapter contract applies: HTTP 400 `VALIDATION_ERROR`, 401
`ADAPTER_UNAUTHORIZED`, 405 `METHOD_NOT_ALLOWED`, 413 `REQUEST_TOO_LARGE`,
415 `UNSUPPORTED_MEDIA_TYPE`, 502 `TMS_AUTH_FAILED`, `UPSTREAM_ERROR`, or
`PROTOCOL_ERROR`, 503 `CONFIGURATION_UNAVAILABLE` or `SERVICE_UNAVAILABLE`,
and 504 `TMS_TIMEOUT`.

#### Sensitive fields excluded

The public load excludes private notes, raw wire data, tokens, full MC values,
and internal purchase-limit policy value/details. No policy value is public
data.

#### Mode/status

`VERIFIED — LOCAL MOCK`. Real endpoint behavior is `IMPLEMENTED — CURRENTLY
UNDER INVESTIGATION`; no approved real ID or evidence exists.

### Public load booking

#### Method

`POST`

#### Path

`/api/tms/loads/book`

#### Authentication header

Required: `x-adapter-api-key: <server-only shared secret>`.

#### Request schema

The body must contain exactly `loadId`, `mc`, and `agreedRate`. `loadId` is at
most 64 characters; `mc` is bounded text; neither may contain `|`, carriage
return, or line feed. `agreedRate` is finite, positive, at most 1,000,000, and
has no more than two decimal places. `mcNumber` is not accepted; `mc` is the
authoritative field.

#### Valid example

```json
{"loadId":"LOAD-1001","mc":"12345","agreedRate":2200}
```

#### Invalid example

```json
{"loadId":"LOAD-1001","mcNumber":"12345","agreedRate":2200}
```

This returns HTTP 400 `VALIDATION_ERROR`.

#### Success response and HTTP 200 status

In local mock mode, HTTP 200 returns `data.booking` with `bookingRef`,
`loadId`, `agreedRate`, `bookedAt`, `mode: "mock"`, and `demo: true`, plus
`meta.requestId` and `x-request-id`.

#### Expected business error response(s) with status/code

Local mock domain errors are HTTP 404 `LOAD_NOT_FOUND`, HTTP 409
`BOOKING_CONFLICT`, and HTTP 422 `RATE_NOT_ACCEPTED`. Real-mode access is
blocked before TMS access with HTTP 403 `REAL_BOOKING_DISABLED`.

#### Transport/technical error response(s) with statuses/codes

The common adapter contract applies: HTTP 400 `VALIDATION_ERROR`, 401
`ADAPTER_UNAUTHORIZED`, 405 `METHOD_NOT_ALLOWED`, 413 `REQUEST_TOO_LARGE`,
415 `UNSUPPORTED_MEDIA_TYPE`, 502 `TMS_AUTH_FAILED`, `UPSTREAM_ERROR`, or
`PROTOCOL_ERROR`, 503 `CONFIGURATION_UNAVAILABLE` or `SERVICE_UNAVAILABLE`,
and 504 `TMS_TIMEOUT`.

#### Sensitive fields excluded

The response excludes tokens, raw wire data, private notes, full MC values,
and internal purchase-limit policy value/details. No policy value is public
data.

#### Mode/status

`VERIFIED — LOCAL MOCK`. Real booking is `NOT IMPLEMENTED`; real `LOAD_BOOK`
has never executed.

### Health

#### Method

`GET`

#### Path

`/api/health`

#### Authentication header

None. This endpoint is unauthenticated.

#### Request schema

No request body or adapter header is required. It performs no external I/O.

#### Valid example

```http
GET /api/health
```

#### Invalid example

```http
POST /api/health
```

This returns HTTP 405 `METHOD_NOT_ALLOWED` with `Allow: GET`.

#### Success response and HTTP 200 status

HTTP 200 with exactly `{"status":"ok"}` and `Cache-Control: no-store`. There
is no adapter envelope and no `requestId` requirement.

#### Expected business error response(s) with status/code

None. This is a liveness contract only, not a dependency-readiness result.

#### Transport/technical error response(s) with statuses/codes

POST and OPTIONS (and other non-GET methods) return HTTP 405
`METHOD_NOT_ALLOWED` with `Allow: GET`. No adapter 401/415/502/503/504 mapping
applies because this endpoint performs no external I/O.

#### Sensitive fields excluded

Only the liveness status is returned; no notes, raw wire data, token, full MC,
or internal purchase-limit policy value/details are returned.

#### Mode/status

`VERIFIED — LOCAL MOCK (liveness contract only)`.

## Public data exclusions

Public load data may contain only the documented public load fields: `loadId`,
origin/destination states and cities, `equipmentType`, `rate`, and optional
`pickupDate`, `miles`, and `status`. Pickup-date semantics remain undefined.
No notes, raw wire data, token, full MC, or internal purchase-limit policy
value/details may be exposed. There is no public `MAX_BUY` value; it is never
public data.

HappyRobot call-record/webhook mapping remains `IMPLEMENTED — CURRENTLY UNDER
INVESTIGATION` until its contract and smoke evidence are agreed.
