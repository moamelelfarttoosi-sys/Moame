---
name: security-review
description: A concrete pre-ship security checklist — injection, authz, secrets, crypto, dependencies — with the greps and commands that find each class. Use before merging anything touching auth, user input, files, or outbound requests.
---

# Security Review

## When to use

Before merging a change that touches authentication, authorization, user-supplied data, file paths, shell commands, outbound HTTP, serialization, or dependencies. Also as a periodic sweep.

## Threat-model in three questions

1. **What is the untrusted input?** Request bodies, query params, headers, cookies, filenames, webhook payloads, third-party API responses, anything in the database that a user put there.
2. **What is worth stealing?** Credentials, tokens, PII, payment data, other tenants' rows.
3. **What is the blast radius** if this one function is fully controlled by an attacker?

## Checklist

### Injection
- [ ] All SQL parameterized — no interpolation into query strings, including `ORDER BY` and `LIMIT`.
- [ ] No shell out with user input; if unavoidable, argument arrays, never a shell string.
- [ ] No `eval`, `new Function`, `exec` on user data.

```bash
grep -rnE "(query|execute)\(.*\\\$\{|\+ *req\.|f\"SELECT" --include='*.{ts,js,py,go}' .
grep -rnE "exec\(|execSync\(|os\.system|subprocess.*shell=True" .
```

### Authorization
- [ ] Every handler that reads or writes a record checks **ownership**, not just authentication.
- [ ] Authorization happens server-side; the client check is UX only.
- [ ] No mass assignment — updates take an explicit field allowlist.
- [ ] Admin routes are enforced by middleware, not by hiding the link.

### Secrets
- [ ] No credentials in source, tests, fixtures, or commit history.
- [ ] `.env` is gitignored; `.env.example` has names only.
- [ ] Secrets never reach logs, error responses, or client bundles (check the `NEXT_PUBLIC_`/`VITE_` prefix rule).

```bash
grep -rnE "(api[_-]?key|secret|token|password)[\"' ]*[:=][\"' ]*[A-Za-z0-9/_+-]{16,}" --exclude-dir=.git .
git log -p --all | grep -nE "BEGIN (RSA|OPENSSH) PRIVATE KEY" | head
```

### Input & files
- [ ] Schema validation at every entry point, with a size limit.
- [ ] Path joins resolved and checked against a base directory (no `../` escape).
- [ ] Uploads: type sniffed from content, size capped, stored outside the web root, served with `Content-Disposition`.

### Crypto & sessions
- [ ] Passwords hashed with bcrypt/argon2 — never MD5, SHA-1, or a bare SHA-256.
- [ ] Tokens from a CSPRNG (`crypto.randomBytes`, `secrets.token_urlsafe`), never `Math.random()`.
- [ ] JWTs: algorithm pinned server-side, signature verified, expiry checked, `none` rejected.
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or stricter.

### Transport & SSRF
- [ ] TLS verification never disabled (`rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify`).
- [ ] User-supplied URLs fetched server-side are allowlisted and resolve away from private ranges (169.254.169.254, 10/8, 127/8).
- [ ] Redirect targets validated against an allowlist.

### Dependencies
- [ ] `npm audit` / `pip-audit` / `govulncheck` clean of high severity.
- [ ] Lockfile committed; no install scripts from unvetted packages.

## Reporting

For each finding: severity, `file:line`, the reachable path from untrusted input, a minimal proof, and the fix. Unreachable patterns are informational — say so rather than inflating the count.
