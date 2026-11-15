# QurbaniOS frontend authentication

QurbaniOS uses the Brocoders HTTP contract with the existing NestJS password, Google verification, and session services. Fastify serves the API at `/api/v1`. The SPA uses the resulting Nest-issued session for every protected route.

## Frontend configuration

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

If the local API is running on port 33005, use that port in `VITE_API_URL`. In production use the deployed API origin and `/api/v1`. Set the SPA origin in backend `FRONTEND_URL` and `ALLOWED_ORIGINS`. Enable SPA fallback for the email-link routes below.

## Auth routes

Paths are relative to `VITE_API_URL`. A 204 response has an empty body. Public sign-in and email routes accept JSON. DTO validation returns 422 with `message`.

| Method and path | Input | Success |
|---|---|---|
| POST /auth/email/register | `{ firstName, lastName, email, password }`. Password length 6–128. | 204, check email |
| POST /auth/email/confirm | `{ hash }` from `/confirm-email?hash=...` | 204, show sign-in |
| POST /auth/email/login | `{ email, password }` | 200 session |
| POST /auth/google/login | `{ idToken }` from Google Identity Services | 200 session |
| POST /auth/refresh | `Authorization: Bearer <refreshToken>`. | 200 rotated session |
| GET /auth/me | Access token | 200 profile |
| POST /auth/logout | Access token | 204, clear session |
| POST /auth/forgot/password | `{ email }` | 204, show generic reset message |
| POST /auth/reset/password | `{ hash, password }`. Hash from `/password-change?hash=...`. | 204, sign in again |
| POST /auth/email/change | Access token and `{ email, password }` with the current password | 204, check the new inbox |
| POST /auth/email/confirm/new | `{ hash }` from `/confirm-new-email?hash=...` | 204, sign in with the new address |

Public email signup requires mailbox confirmation before sign-in. Changing an email or resetting a password revokes existing sessions. Remove confirmation hashes from the address bar after completing the request.

## Continue with Google

Create a Google **Web application** OAuth client and add each SPA origin under **Authorized JavaScript origins**. Set the same client ID in `VITE_GOOGLE_CLIENT_ID` on the SPA and `GOOGLE_CLIENT_ID` in Nest, and set `GOOGLE_OAUTH_ENABLED=true` in Nest. The Google Identity Services popup uses authorised origins. The SPA loads the GIS script, calls `google.accounts.id.initialize` and passes its returned `credential` to `POST /auth/google/login` as `idToken`. Nest checks the token signature, issuer, audience and verified email before creating or loading a user. A collision with an existing email returns 409 and the user can sign in with their original method. [Google configuration](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) · [Server verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

## Session, profile and workspace

Both sign-in routes and refresh return `{ token, refreshToken, tokenExpires, user }`. `tokenExpires` is Unix milliseconds. Keep tokens in memory, serialize refresh requests, and replace the old pair after rotation. Use `Authorization: Bearer <token>` on protected calls. If refresh fails or the session is revoked, clear profile and protected data and return to sign-in.

`GET /auth/me` returns the profile directly. It includes the opaque string user ID, `firstName`, `lastName`, email, `role: { id, name }`, `status: { id, name }`, and the global `roles` and `permissions` lists. `organisations` contains workspace summaries and their role slugs, and `organisation` identifies the current active workspace when one can be determined. Use `roles` to distinguish global `super_admin` from regular accounts and workspace role `org_admin` for Committee Admin. The backend checks current membership and resource ownership independently of what navigation is shown.

An authorised admin can `POST /users` with `{ firstName, lastName, email, password, role: { id: 2 }, status: { id: 1 } }` to create an active regular account. The account can log in immediately. Its email remains unverified, and possession checks still apply to committee invitations, volunteers and beneficiaries.

## Environment verification

For the API, set `AUTH_MODE=brocoders`, `API_PREFIX=api/v1`, `JWT_ACCESS_SECRET`, database configuration, and your SPA origins. Configure SMTP for actual confirmation and recovery mail and assign Google origins for live popup testing. The local synthetic smoke verifies routes and session behaviour with a local database, captured email and stubbed Google verification. A deployed URL, real Google sign-in, actual mail delivery and shared role accounts need separate verification.
