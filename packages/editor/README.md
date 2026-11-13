# @pagecraft/editor

Versioned Pagecraft editor bundle for trusted hosts such as the native WordPress Builder.

Pagecraft Cloud owns the source document schema and renderer. Consumers pin an exact package version, bundle the generated files into their own release, and never fetch this package at runtime.

Every host adapter exposes an immutable feature contract. The WordPress contract omits Cloud-only product surfaces and delegates pages, media, menus, revisions, preview, publishing, globals, and dynamic content to WordPress-owned adapters.

## Sealed WordPress compiler

`compiler.js` exports a browser API for rebuilding saved output from an authoritative Pagecraft document without opening or mutating an editor session:

```js
import { compile, dispose } from '@pagecraft/editor/compiler.js';

const result = await compile(document, {
  pageId: 'page-id',
  assets: { hero: { url: 'https://example.test/uploads/hero.jpg' } },
  wordpressContent: {
    'pagecraft:wordpress-content:page:L2NvbnRhY3Qv': 'https://example.test/contact/'
  },
  // The native `/menus` response can be supplied directly.
  wordpressMenus: [
    { id: '12', location: 'primary', items: [{ label: 'Home', url: 'https://example.test/' }] }
  ],
  design: { maxWidth: '1200px' }
}, { timeoutMs: 60_000 });
```

The client serializes requests through a dedicated `compiler-worker.js` realm. Requests time out after 60 seconds by default; a timeout terminates the worker and rejects every queued request so later work can start in a clean realm. Each result contains the exact five-key compiler descriptor plus `html`, `globalCss`, `pageCss`, `fontCss`, and a SHA-256 `contentHash` of the three persisted output fields. Call `dispose()` when a maintenance screen is finished.

The caller supplies current WordPress menu, media, content-link, and site-design snapshots. Asset and content tokens fail closed when a mapping is missing. Asset URLs must be durable HTTP(S) URLs; object URLs and embedded media bytes are outside this compiler boundary. Google Fonts are fetched while compiling, so a font network failure also fails the request instead of publishing incomplete CSS.

Preview packages use one explicit version for the contract, editor literal, compiler worker, and tarball manifest without rewriting tracked source files:

```sh
PAGECRAFT_EDITOR_VERSION=0.2.17-preview.20261015.13 \
  npm run --workspace @pagecraft/editor pack:sealed -- --pack-destination /path/to/pagecraft-wordpress/packages
```

`PAGECRAFT_EDITOR_VERSION` must be valid semver. A normal build omits it and verifies that `package.json` still matches the source compiler version.
