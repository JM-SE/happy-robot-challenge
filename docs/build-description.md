# Build description

## Business problem

Carrier-sales staff need a controlled way to find loads, verify carrier information, negotiate a rate, and hand off a booking decision. This build supplies the adapter boundary and a local demonstration path without claiming external carrier, OTP, or end-to-end business-capability verification. Railway deployment and the complete, connected HappyRobot App are user-confirmed; external provider/dependency smoke evidence remains unrecorded.

## Proposed workflow

1. The implemented and connected HappyRobot App, including Web Call and Inbound Voice Agent surfaces, gathers carrier and load information; those surfaces are **IMPLEMENTED — NOT CURRENTLY VERIFIED** because provider smoke evidence is not recorded.
2. FMCSA and OTP handoffs are expected to verify carrier and compliance; unavailable here.
3. The adapter accepts authenticated, validated load search/detail requests.
4. It reads from a local mock or guarded read-only TMS TCP path.
5. Negotiation and booking remain controlled handoffs. Mock booking is deterministic; real booking is disabled.
6. A provisional call-record webhook may feed the temporary Operations projection.

## Architecture

Next.js Node route handlers call a server-only adapter. It validates requests, adds request IDs, maps safe load fields, and translates errors. The lower-level TCP protocol is a byte stream with CRLF framing, `END` plus peer close, and one socket per request. The mock supplies deterministic records and fault scenarios.

## Data flow

The caller sends a closed JSON request to the authenticated adapter route. The route validates and normalizes it, assigns a request ID, then selects the local mock or the guarded read-only TCP adapter. Only mapped public load fields return to the caller. Booking mock responses stop locally; real booking is rejected before any TMS access.

## Carrier verification

Carrier verification through FMCSA is **OUT OF SCOPE** for this build. No live FMCSA provider, consent flow, or verification result is claimed.

## OTP compliance behavior

OTP delivery/verification is **BLOCKED — ORGANIZATION/ENVIRONMENT**. The adapter does not claim to send or verify SMS/email OTP, and no compliance decision is made here.

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

Real read-only endpoint behavior has status **IMPLEMENTED — CURRENTLY UNDER INVESTIGATION**. There is no approved real load ID, real booking is disabled, no real-booking rollback/reconciliation procedure, no OTP delivery, no Twin capacity, and no durable operations store. HappyRobot App, Web Call, and Inbound Voice Agent are deployed/complete and connected by user confirmation; remaining contract/mapping questions, external provider smoke evidence, and full business-capability evidence are unrecorded. The Operations UI fallback/demo data is not evidence of external integration.

## Future production requirements

Future production requirements include approved real-TMS read-only evidence, HappyRobot smoke tests, FMCSA and OTP providers, Twin capacity, an approved negotiation and reconciliation procedure, durable storage, observability, approved transport security, Railway verification, and explicit authorization before any real booking capability.
