# Security Rules

These are mandatory. They apply to every change, without being asked.

## Secrets

- Never write a credential, API key, token, or password into source, tests, fixtures, or a commit message.
- Read secrets from the environment. Add the name (never the value) to `.env.example`.
- Never log a secret, a full request body, an `Authorization` header, or a session token.
- Never expose a secret to client-side code. Anything prefixed `NEXT_PUBLIC_`/`VITE_`/`REACT_APP_` is public.

## Input

- Validate every external input at the boundary with a schema, including a size limit.
- Parameterize every SQL query. No interpolation into a query string, ever — including `ORDER BY`.
- Never pass user input to a shell. If a subprocess is unavoidable, use an argument array.
- Never `eval`, `new Function`, or `exec` user-supplied data.
- Resolve and range-check any path built from user input before touching the filesystem.

## Authorization

- Authenticate *and* authorize on the server for every request that reads or writes data.
- Check ownership of the specific record, not just that someone is logged in.
- Update with an explicit field allowlist. No mass assignment.
- A hidden UI control is not an access control.

## Crypto & sessions

- Passwords: bcrypt or argon2. Never MD5, SHA-1, or plain SHA-256.
- Tokens and ids: a CSPRNG (`crypto.randomBytes`, `secrets.token_urlsafe`). Never `Math.random()`.
- JWTs: pin the algorithm server-side, verify the signature, check expiry, reject `none`.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or stricter.

## Network

- Never disable TLS verification. Not in tests, not "temporarily".
- Set an explicit timeout on every outbound call.
- Allowlist any user-supplied URL fetched server-side, and block private/link-local ranges.

## Dependencies

- Do not add a dependency for something the standard library or an existing dependency already does.
- Commit the lockfile. Keep the audit tool clean of high-severity findings.

## When you find a vulnerability

Report it with severity, `file:line`, the path from untrusted input, and the fix. Fix it in the same change when it is in scope; when it is not, say so explicitly rather than staying silent.
