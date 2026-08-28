---
name: backend-patterns
description: API design, database access, caching, background jobs and observability patterns for server-side work. Use when building or reviewing endpoints, queries, queues, or anything with a latency or consistency requirement.
---

# Backend Patterns

## When to use

Designing an endpoint, touching the data layer, adding a cache or a queue, or debugging a slow/flaky server path.

## API design

- **Resource-shaped URLs, verbs in the method.** `POST /orders/{id}/refunds`, not `POST /doRefund`.
- **Consistent envelope.** Pick one and never vary it:
  ```json
  { "items": [], "nextCursor": null }
  { "error": { "code": "order_not_found", "message": "...", "requestId": "..." } }
  ```
- **Cursor pagination**, not offset — offset drifts and degrades on large tables.
- **Idempotency keys** on every non-GET that costs money or sends a message. Store key → response for 24h and replay it.
- **Validate at the edge** with a schema; the handler receives a parsed type, never a raw body.
- **Version when you break.** Additive changes are free; removals and renames are not.

## Status codes that matter

`400` malformed · `401` unauthenticated · `403` authenticated but not allowed · `404` absent or invisible · `409` conflict/version mismatch · `422` semantically invalid · `429` rate limited (with `Retry-After`) · `502/504` upstream failed.

## Database

- **N+1 is the default bug.** Batch with `IN`, a join, or a dataloader. Assert query counts in tests for hot paths.
- **Transactions wrap the invariant, not the request.** Keep them short; never do network I/O inside one.
- **Optimistic concurrency** (`WHERE version = ?`) beats long locks for user-facing writes.
- **Index for the query you run**, composite in the order of equality → range → sort.
- **Read replicas need read-your-writes handling.** Route the post-write read to the primary or the user sees stale data.
- **Soft deletes need a partial unique index**, or "deleted" rows keep blocking new ones.

## Caching

| Layer | Use for | Invalidation |
|---|---|---|
| Request-scoped memo | Repeated lookups in one request | Automatic |
| Local LRU | Small, hot, tolerant of staleness | TTL |
| Redis | Shared, cross-instance | Explicit key delete on write |
| HTTP/CDN | Public, cacheable GETs | `ETag` + `max-age` |

Rules: cache the *derived* value, not the raw row. Always set a TTL — an unbounded cache is a memory leak with a delay. Stampede protection (single-flight or jittered TTL) on anything expensive.

## Background work

- Jobs must be **idempotent** — they will run twice.
- Payload carries an **id, not an object** — the object goes stale in the queue.
- **Bounded retries with exponential backoff and jitter**, then a dead-letter queue you actually monitor.
- Long jobs report progress and are cancellable.

## Observability

- **Structured logs** with a `requestId` propagated through every layer.
- **Log the decision, not the data.** Never log tokens, passwords, PII, or full request bodies.
- Metrics: rate, errors, duration (RED) per endpoint; saturation for pools and queues.
- Latency as **p50/p95/p99** — an average hides every incident.

## Failure handling

Timeouts on every network call (there is no default worth trusting) · retries only on idempotent operations · circuit-break a dependency that is failing rather than queueing behind it · degrade to a partial response before returning a 500.
