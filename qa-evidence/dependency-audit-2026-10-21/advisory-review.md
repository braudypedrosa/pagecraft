# Dependency advisory review — 2026-10-21

Official reviewed advisories and minimum fixed releases:

- `sanitize-html` 2.18.0: GHSA-x3q4-9hxx-gx8m, GHSA-374f-7chj-9948, GHSA-cv27-6wvh-8x7j.
  - https://github.com/advisories/GHSA-x3q4-9hxx-gx8m
  - https://github.com/advisories/GHSA-374f-7chj-9948
  - https://github.com/advisories/GHSA-cv27-6wvh-8x7j
- Vite 8.2.4 (`launch-editor` 2.14.2): GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm.
  - https://github.com/advisories/GHSA-698v-4r3x-3vcv
  - https://github.com/advisories/GHSA-r825-w8mm-5pxw
  - https://github.com/advisories/GHSA-587h-7wmj-h5pm
- `@modelcontextprotocol/server` 2.3.0: GHSA-jm63-cq47-j5jp, GHSA-46jr-4wx8-v453, GHSA-rvq5-wwqv-78pq.
  - https://github.com/advisories/GHSA-jm63-cq47-j5jp
  - https://github.com/advisories/GHSA-46jr-4wx8-v453
  - https://github.com/advisories/GHSA-rvq5-wwqv-78pq

## Pagecraft exposure assessment

- Rich text: Pagecraft's production configuration omits SVG/SMIL and `meta`, restricts attributes and schemes, and rejects a CMS rich value whenever sanitization changes it. Exact current advisory payload families are rejected by `safeRichHtml`; ordinary toolbar markup remains accepted. No stored-XSS route was reproduced through this boundary.
- Vite: the affected editor launcher belongs to the development server. The reviewed exploits require Windows or WSL plus attacker influence over a path, filename, environment variable, or editor choice. It is not part of Pagecraft's published runtime.
- MCP client mixing: Pagecraft constructs a fresh `McpServer` through a factory for each HTTP exchange. The advisory explicitly lists this pattern as unaffected. The same-request-ID concurrency regression confirms responses remain scoped to their own read context.
- MCP bearer audience: Pagecraft does not use the SDK's `requireBearerAuth` or `verifyBearerToken`. It validates its opaque assistant/integration token before calling the SDK and only then supplies `authInfo`, so the affected SDK verifier path is not used.
- MCP request exhaustion: authentication occurs before SDK parsing. Both production handlers now enforce a 1,000,000-byte body ceiling while streaming and a 10,000-member tool-input ceiling. Tests cross the body limit using multibyte UTF-8 without `Content-Length`, cross the structural limit with 10,001 shallow members, and confirm rejection before the tool callback. No exhaustion payload was executed.
