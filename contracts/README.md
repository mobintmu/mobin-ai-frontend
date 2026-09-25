# Provisional API contract — backend confirmation required

No `mobin-ai-backend` OpenAPI artifact exists yet. This frontend uses the schemas below as a **provisional fixture**, based on the frontend and backend prompts dated 2026-09-25. It must be replaced by a pinned, generated backend `openapi.json` before production deployment.

| Decision | Working assumption to confirm |
| --- | --- |
| Credential transport | Opaque bearer token in `POST /conversations`, sent in `Authorization`; 30-day expiry shown by `expires_at` |
| Quota | 100 accepted answers per token; backend alone counts and reports it |
| New conversations | One-time `registration_grant` exchanges for one token; backend decides later renewal policy |
| Registration | Separate `given_name` and `family_name`, contact fields nullable, policy version and `turnstile_token` |
| Idempotency | `Idempotency-Key` accepted on both answer routes; same key returns the same outcome |
| Streaming | POST SSE events `retrieving`, `citation`, `delta`, `complete`, `error`; `complete` contains the full answer response |
| History | `{ "messages": [{ "id", "role", "content", "citations"?, "grounded"? }] }` |
| Feedback | `POST /messages/{id}/feedback` accepts `{ "rating": "helpful" | "not_helpful" }` |

The frontend detects a missing streaming route (404/405/501) and uses the non-streaming route with the same key. An interrupted stream is reconciled with server history before the visitor decides whether to retry. There is no automatic replay after an ambiguous failure.

The frontend must be checked against the backend's actual OpenAPI, including exact history pagination, SSE event payloads, question length, feedback shape, error codes, and Turnstile verification lifecycle. Backend CORS must allow the chat origin and every scoped request must authorize the bearer token.
