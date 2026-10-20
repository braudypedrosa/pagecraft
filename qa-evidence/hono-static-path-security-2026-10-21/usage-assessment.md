# Hono static path security checkpoint

- Advisory: https://github.com/honojs/hono/security/advisories/GHSA-5r4p-p66f-jhc7
- The advisory affects Hono serveStatic versions >=4.12.4 and <4.13.11.
- Pagecraft directly depends on Hono and imports @hono/node-server/serve-static in server/src/app.ts. Authenticated static surfaces include brand assets and component gallery baselines.
- The regression proves the authenticated component baseline fixture serves normally (HTTP 200, image/png) and that plain, encoded, and double-encoded dot aliases remain HTTP 404 without a session.
- This is a dependency remediation and auth-boundary regression; it does not claim a demonstrated Pagecraft exploit.
