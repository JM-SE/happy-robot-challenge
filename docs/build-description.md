# Build description

## Business problem

Carrier-sales staff need a controlled way to find loads, verify carrier information, negotiate a rate, and hand off a booking decision. This build supplies the adapter boundary and a local demonstration path without claiming external carrier, OTP, or end-to-end business-capability verification. The HappyRobot App is user-confirmed complete and connected, while the intended HappyRobot Apps repository deployment/import remains blocked or unverified. Railway is only an adapter-hosting workaround; limited external read-only TMS smoke is recorded separately.

## Proposed workflow

1. The implemented and connected HappyRobot App, including Web Call and Inbound Voice Agent surfaces, gathers carrier and load information; those surfaces are **IMPLEMENTED — NOT CURRENTLY VERIFIED** because provider smoke evidence is not recorded.
2. The HappyRobot App initiates FMCSA validation through a direct App request and owns that capability. OTP verification must occur during the call after FMCSA authority validation and before load matching; the required OTP provider/gate is currently unavailable. The adapter consumes only trusted, fresh, identity-bound handoff results for any controlled real booking flow.
3. The adapter accepts authenticated, validated load search/detail requests.
4. It reads from a local mock or guarded read-only TMS TCP path.
5. Negotiation and booking remain controlled handoffs. The private internal rate authority rejects an agreed rate above the selected load's `MAX_BUY` before booking authorization; mock booking retains the same check as defense in depth. Mock booking is deterministic; real booking is disabled.
6. A provisional call-record webhook may feed the temporary Operations projection.

## Architecture

Next.js Node route handlers call a server-only adapter. It validates requests, adds request IDs, maps safe load fields, and translates errors. The lower-level TCP protocol is a byte stream with CRLF framing, `END` plus peer close, and one socket per request. The mock supplies deterministic records and fault scenarios.

## Data flow

The caller sends a closed JSON request to the authenticated adapter route. The route validates and normalizes it, assigns a request ID, then selects the local mock or the guarded read-only TCP adapter. Only mapped public load fields return to the caller. Booking mock responses stop locally; real booking is rejected before any TMS access.

## Carrier verification

FMCSA validation is in scope of the HappyRobot App and is initiated through a direct App request. It is not implemented or owned by the TMS adapter. The adapter only depends on a reliable, fresh, identity-bound FMCSA validation result for any controlled real booking flow; it must not simulate FMCSA validation or accept an MC-format string as proof. Current validation is **IMPLEMENTED — NOT CURRENTLY VERIFIED**: no successful FMCSA result was captured for MC 872144, so the controlled real process remains blocked. This is a verification/evidence limitation, not a determination that MC 872144 is invalid.

## OTP compliance behavior

OTP delivery/verification is **BLOCKED — ORGANIZATION/ENVIRONMENT**. HappyRobot owns the send/verify step, but no provider or hard pre-match gate is currently available. The adapter does not claim to send or verify SMS/email OTP, and no compliance decision is made here. Load matching must not be treated as proof that OTP was completed.

## Load search

The search route validates the allowed filters and returns deterministic local mock records. The real read-only `LOAD_QUERY` path has status **IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**; no approved real endpoint evidence is recorded.

## Load detail retrieval

The detail route validates `loadId` and returns a mapped local mock record or a local not-found result. The real read-only `LOAD_GET` path has status **IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**, and no approved real `LOAD_ID` exists.

## Negotiation behavior

Automated negotiation is **OUT OF SCOPE**. A future voice or operations workflow may collect an offer, but this adapter does not claim a production negotiation engine, authority policy, or approval workflow.

## Booking behavior

Mock booking is **VERIFIED — LOCAL MOCK** and deterministic. Real booking is **NOT IMPLEMENTED** and fails closed with `REAL_BOOKING_DISABLED`; `LOAD_BOOK` has never been executed against a real system.

## Mock handoff behavior

Local mock mode supports deterministic search, detail, and booking demonstrations without external TMS access. Mock fault scenarios are for local validation only. The HappyRobot call-record handoff is connected in the completed App by user confirmation, with status **IMPLEMENTED — NOT CURRENTLY VERIFIED**; remaining contract/mapping questions and provider smoke evidence must be resolved before reliance.

## Logging/data layer

Request IDs support correlation. Errors are sanitized and raw upstream details, tokens, private notes, and internal purchase ceilings are excluded. The Operations projection is process-local, in-memory, and non-persistent; Twin is unavailable.

## Security model

Public load data is limited to load ID, states, cities, equipment, rate, and optional pickup date, miles, and status. Private notes and internal purchase ceilings are not exposed. Secrets and TMS tokens stay in server-only environment variables. Errors are sanitized and request IDs support correlation. TLS is not implemented.

## Failure handling

Failures include invalid requests, unauthorized callers, unavailable configuration, TMS timeout/protocol/upstream errors, conflicts, and disabled booking. Errors use stable public codes and omit raw upstream details. No automatic booking retry is allowed. Health is liveness, not readiness.

## Deployment model

The Docker image is used by a Railway service deployed by user confirmation as a hosting workaround because HappyRobot infrastructure could not host the app. Railway injects `PORT`; no public URL or TLS/provider contract is claimed, and external smoke-test evidence is not recorded/not run.

## Operational limitations

Real read-only endpoint behavior has status **IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**. There is no approved real load ID, real booking is disabled, no real-booking rollback/reconciliation procedure, no OTP delivery, no Twin capacity, and no durable operations store. HappyRobot App, Web Call, and Inbound Voice Agent are deployed/complete and connected by user confirmation; FMCSA validation is App-owned and **IMPLEMENTED — NOT CURRENTLY VERIFIED** because no successful result was captured for MC 872144. The internal rate authority is verified at the local authorization/booking boundary, but negotiation-stage enforcement is not claimed. Remaining contract/mapping questions, external provider smoke evidence, and full business-capability evidence are unrecorded. The Operations UI fallback/demo data is not evidence of external integration.

## Future production requirements

Future production requirements include approved real-TMS read-only evidence, HappyRobot App smoke tests, successful HappyRobot Apps repository import/deployment, a recorded FMCSA result from the App with consent/auditability, freshness and carrier/session identity binding for the controlled handoff, an OTP provider and hard pre-match gate, Twin capacity, a rate-authority handshake before final acceptance if the App owns negotiation, an approved negotiation and reconciliation procedure, durable storage, observability, approved transport security, and explicit authorization before any real booking capability. Railway verification is only an adapter-workaround concern, not proof of the intended HappyRobot Apps deployment.
