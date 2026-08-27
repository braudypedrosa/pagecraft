# Pagecraft account launch checklist

Pagecraft uses Supabase Auth for verified email/password identity and secure session rotation.
The Hono server remains the only browser-facing data boundary: it maps a verified Supabase user ID
to `public.users.auth_user_id`, then authorizes every site through `public.site_users`.

## Supabase Auth

In the Pagecraft Supabase project:

1. Enable email/password signup and require email confirmation.
2. Set the Site URL to `https://build.itspagecraft.com`.
3. Add these redirect URLs:
   - `https://build.itspagecraft.com/auth/confirm`
   - `http://localhost:8787/auth/confirm`
   - the exact callback URL for any other documented local port in use
4. Configure custom SMTP and send test confirmation and recovery messages before production.
5. Point the confirmation template at
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type={{ .EmailActionType }}` and the recovery
   template at `{{ .RedirectTo }}&token_hash={{ .TokenHash }}` (the recovery redirect already
   carries `type=recovery`). If the provider emits a PKCE `code` instead, `/auth/confirm` accepts
   that format too.
6. Set the minimum password length to 12. Enable leaked-password protection when the project plan
   exposes it.

## Google sign-in

Create a Google Cloud OAuth 2.0 Web application for Pagecraft, then enable the Google provider under
Supabase Auth Providers. Use `https://build.itspagecraft.com` as the authorized JavaScript origin
and use the Supabase callback URL shown on the Google provider settings page as the authorized
redirect URI (normally `https://<project-ref>.supabase.co/auth/v1/callback`). Store the Google client
ID and secret only in Supabase. Do not add either credential to Pagecraft's environment or repository.

Keep the application callback URLs listed above. After Google completes its Supabase callback,
Supabase sends the browser to `/auth/confirm`; Pagecraft exchanges the PKCE code server-side,
provisions the verified local profile, and returns the user to their safe local destination.

Never put the service-role key in the Pagecraft application. The server needs only the project URL
and publishable key for Auth; database access continues through the private fixed-operation gateway.

## Cloudflare Turnstile

Create a managed Turnstile widget for `build.itspagecraft.com`. Put the site key in the application
environment, then enable Turnstile under Supabase Auth's Bot and Abuse Protection settings and put
the secret key there. Pagecraft passes each token to Supabase Auth for one-time validation during
signup, login, and password recovery; the application never consumes it with a second verifier.

## Application environment

Production requires all of these and refuses to start when one is missing:

```text
NODE_ENV=production
EDITOR_HOST=build.itspagecraft.com
EDITOR_ORIGIN=https://build.itspagecraft.com
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
TURNSTILE_SITE_KEY=<site-key>
```

Local development must also provide a local Supabase URL/publishable key and a site key. To use the
deterministic challenge verifier in automated local tests, set `PAGECRAFT_AUTH_TEST_MODE=1` and send
`pagecraft-test-human` as the challenge token. That variable is rejected in production.

## Release and rollback

Release in this order:

1. Apply `20260827063203_supabase_auth_profiles.sql` and deploy the updated `pagecraft-db` function.
2. Configure Supabase Auth redirects, confirmation, password policy, leaked-password protection
   when available, and custom SMTP.
3. Configure Turnstile in Cloudflare and Supabase Auth, then release the application.
4. Smoke-test signup, captured development email confirmation, dashboard, site creation, builder,
   Sites return action, password recovery, and sign-out on desktop and mobile.

The migration deliberately retains `login_links` and `sessions` for one release. Rollback may run
the previous application against those tables; remove them only in a later cleanup migration.
