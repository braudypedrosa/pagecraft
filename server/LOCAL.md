# Local Cloud application

Run Docker Desktop, then from the repository root:

```sh
npm run local
```

Open http://localhost:8787. Use the actual dashboard, `/sign-up`, `/sign-in`, `/edit/:id`, asset library, and published `/:slug/` routes. This builds the current checkout and runs `server/src/index.ts`, the same application entry point used by the production bridge. It is not the standalone HTML preview.

The launcher uses a separate `pagecraft-local` Supabase project with the checked-in migrations and the same `pagecraft-db` Edge Function implementation as Cloud. Local Postgres, Auth and Storage persist across restarts. Confirmation emails go to the local inbox at http://127.0.0.1:55424. Create test accounts through the normal signup flow. Production accounts, data and credentials are not copied or used.

Local gateway credentials and immutable publication files live under ignored `.pagecraft-local/development/`. The launcher rejects non-loopback Supabase destinations and strips inherited production configuration. The Node server binds to loopback. Supabase uses ports 55420–55429 to avoid other existing local projects.

Stop the application with Ctrl+C. `npm run local:stop` stops this Supabase project while retaining its database. Do not use reset or `--no-backup` unless you intend to discard test data. Restart `npm run local` after source changes to rebuild the editor and reload server code.

## Parity boundaries

The local application uses candidate code from this checkout, so uncommitted changes are included. It mirrors application code paths, not an exact snapshot of currently deployed production files.

- Google OAuth needs separate local OAuth provider credentials and callback registration; it is not configured by this launcher.
- Local HTTP replaces Cloudflare HTTPS and Passenger hosting. Secure cookies, real certificates, DNS, proxy behavior and production email delivery require staging verification.
- CAPTCHA uses explicit local challenge mode with a visible development label and local Supabase enforcement disabled. Production rejects this mode.
- WordPress release signing and package distribution are not configured by this launcher. Provision separate test signing keys and locally built packages before testing that workflow. Never copy the production private signing key.
- The launcher uses checked-in migrations; production schema drift must be checked separately before release.

Supabase's local service workflow is documented at https://supabase.com/docs/guides/local-development/cli/getting-started.

## Verified on 2026-09-08

Local migrations applied; gateway ready; normal signup generated confirmation mail; email confirmed; browser password sign-in, site creation, editor loading, heading edit, save, and local publishing passed. Published content survived an application restart. Account tests: 22 passed. Local challenge rendering and production separation checked. WordPress release signing, Google OAuth, media upload and collaborator invitation journeys were not verified in this setup.
