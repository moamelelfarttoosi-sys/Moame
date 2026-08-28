---
name: frontend-patterns
description: React and Next.js patterns for state, data fetching, rendering strategy, forms, performance and accessibility. Use when building or reviewing UI components, pages, or client-side data flow.
---

# Frontend Patterns

## When to use

Adding a component or route, wiring data into the UI, or fixing a re-render, hydration, or accessibility problem.

## State: pick the narrowest home

1. **Derive it.** If it can be computed from props/state during render, do not store it.
2. **URL** — anything the user should be able to share or reload into: filters, tabs, pagination, selected id.
3. **Local `useState`** — ephemeral UI: open/closed, hover, draft input.
4. **Server cache** (TanStack Query, SWR, RSC fetch) — anything that came from the server. This is a cache, not state.
5. **Global store** — only genuinely cross-cutting client state: session, theme, feature flags.

The most common bug in a React codebase is server data copied into `useState` and then drifting.

## Data fetching

- Fetch on the server where the framework allows it; the browser waterfall is the slowest path.
- Never fetch in a `useEffect` when a data library or a server component can do it — you will reimplement caching, dedupe, retries and race handling, badly.
- Every fetch has three visible states: loading, error, empty. Design all three before the happy path.
- Mutations: optimistic update → invalidate the affected keys → rollback on error.

## Next.js rendering

| Content | Strategy |
|---|---|
| Static marketing, docs | Static (SSG) |
| Mostly static, occasionally updated | ISR with `revalidate` |
| Per-user, per-request | Server component / SSR |
| Highly interactive after load | Server shell + client island |

Keep `"use client"` at the leaves. One client component at the top of the tree makes the whole subtree client.

## Components

- Props describe *what*, not *how*: `variant="danger"`, not `color="#c00"`.
- Composition over configuration — a component with nine booleans should have been three components.
- Colocate: component, styles, test and stories together.
- Lists need stable keys from the data. Index keys corrupt state on reorder.

## Forms

- One library, used consistently (react-hook-form + a schema resolver).
- Validate with the **same schema** on client and server. The client copy is UX; the server copy is the rule.
- Disable submit while pending and show the pending state — double submits are otherwise guaranteed.
- Errors go next to the field, are announced (`aria-describedby`, `role="alert"`), and survive re-render.

## Performance

- Measure before optimizing: React DevTools Profiler, Lighthouse, the network waterfall.
- `memo`/`useMemo`/`useCallback` only with a measured re-render problem — each one has a cost.
- Split at the route boundary first, then at heavy widgets (editors, charts, maps).
- Images through the framework's image component with explicit dimensions; no layout shift.
- Watch the bundle: a date library or an icon set imported wholesale is usually the biggest single win.

## Accessibility (non-negotiable)

- Semantic elements first — a `<div onClick>` is not a button and is not reachable by keyboard.
- Every interactive element is focusable, has a visible focus ring, and works with Enter/Space.
- Labels tied to inputs; images have `alt` (empty `alt=""` when decorative).
- Colour contrast ≥ 4.5:1 for body text.
- Modals trap focus, close on Escape, and return focus to the trigger.
- Respect `prefers-reduced-motion`.
