# Task close — sanitize-html security patch

- Updated root and server workspace manifests from `sanitize-html` `2.18.0` to `2.18.1`.
- Updated only the necessary lockfile dependency records; `deepmerge` became unused by the patched package and was removed by the lock resolver.
- Added a focused regression through the project sanitizer at `server/src/safe-html.ts`.

Verification:

- The pre-patch regression reproduced `Maximum call stack size exceeded` with 2,000 nested discarded `<iframe>` elements.
- The patched focused suite passes 2 tests: deep discarded-iframe fallback completes without recursion failure, and ordinary iframe fallback remains stripped without an executable iframe/source attribute.
- `npm audit --audit-level=moderate` reports `found 0 vulnerabilities`.
- The shared `node_modules` symlink was removed before installing a worktree-local dependency tree; the shared target was not modified.

No application source, Controls, Main checkout, browser, build, or deployment changes were made. This is a bounded sanitizer regression, not a full sanitizer corpus audit.
