# Limitations

Environmental limitations concern unavailable providers, credentials, deployment access, or external evidence. Code/scope/safety limitations concern intentionally bounded behavior in this build.

| Limitation | Classification | Status |
|---|---|---|
| Real LOAD_QUERY/LOAD_GET evidence is partial: one successful Railway read-only search/detail sample | Environmental: limited external endpoint coverage | VERIFIED — LIMITED REAL READ-ONLY SMOKE |
| No approved real LOAD_ID | Environmental: approved probe input unavailable | BLOCKED — ORGANIZATION/ENVIRONMENT |
| Real LOAD_BOOK never executed; real mode disabled with HTTP 403 `REAL_BOOKING_DISABLED` | Code/safety: deliberate restriction | NOT IMPLEMENTED / disabled |
| Real booking disabled; no rollback/reconciliation procedure | Code/safety and operational: authorization/procedure absent | OUT OF SCOPE |
| HappyRobot App is deployed/complete and connected; provider/dependency smoke evidence absent | Environmental/integration: external smoke evidence unavailable | IMPLEMENTED — NOT CURRENTLY VERIFIED |
| Web Call and Inbound Voice Agent are implemented in the completed HappyRobot App; provider/dependency smoke evidence absent | Environmental/integration: external smoke and full business-capability evidence unavailable | IMPLEMENTED — NOT CURRENTLY VERIFIED |
| FMCSA validation is App-owned and initiated through a direct App request; the adapter does not implement it or accept MC formatting as proof | Environmental/evidence: no successful verifiable result was captured for the only available MC, 872144 | IMPLEMENTED — NOT CURRENTLY VERIFIED; controlled real process blocked. MC validity is not determined |
| SMS/email OTP unavailable | Environmental: organization/provider unavailable | BLOCKED — ORGANIZATION/ENVIRONMENT |
| Twin unavailable due organization DB quota | Environmental: organization quota exceeded | BLOCKED — ORGANIZATION/ENVIRONMENT |
| Operations UI fallback/demo data is process-local, in-memory, and non-persistent | Code/scope: temporary projection | IMPLEMENTED — NOT CURRENTLY VERIFIED |
| Railway deployment exists by user confirmation; limited external health/read-only smoke evidence is recorded | Environmental/operations: deployment confirmed by user, point-in-time smoke only | IMPLEMENTED — NOT CURRENTLY VERIFIED |
| Docker not externally verified | Environmental/operations: no external build evidence | IMPLEMENTED — NOT CURRENTLY VERIFIED |
| TLS transport absent | Code/scope: transport security not implemented | OUT OF SCOPE |
| Automated negotiation engine absent | Code/scope: negotiation is not included | OUT OF SCOPE |
| Health is liveness, not readiness | Code/contract: dependency readiness is not asserted | VERIFIED — LOCAL MOCK |
| Pickup-date business semantics unspecified | Code/contract: product meaning unresolved | NOT IMPLEMENTED |

Internal purchase-limit policy is server-side only; its value and decision details are not public data.
