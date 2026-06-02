# @0xsignal/auth

This package implements authentication and session management in the 0xsignal monorepo, powered by Effect-TS, Arctic (OAuth), and Jose (JWT).

## Flow Documentation

To understand how authentication flows from the React frontend to the backend service and database, refer to the following end-to-end documents:

- [Google OAuth 2.0 (with PKCE) Flow](docs/google_oauth_flow.md)
- [GitHub OAuth 2.0 (No PKCE & Resilient Fetch) Flow](docs/github_oauth_flow.md)

## Architecture Overview

1. **State & CSRF Protection**: Temporary `state` parameters and PKCE `code_verifier` credentials are saved in the `oauth_states` table. The backend consumes them dynamically upon callback to validate requests.
2. **One-Time Code Exchange**: Instead of exposing JWTs in the browser landing URL, the backend generates a short-lived `auth_code` (30s TTL). The frontend exchanges this code on a secure backchannel via `POST /api/auth/token`.
3. **In-Memory JWT Access Tokens**: The Issued `accessToken` is stored strictly in memory on the client side, eliminating XSS exposure.
4. **Rotated HTTP-only Refresh Cookies**: Sessions are maintained securely using an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped exclusively to `/api/auth/refresh` that rotates on every silent session refresh.
