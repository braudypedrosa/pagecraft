# Vitest dependency follow-up — 22 October 2026

Status: open, separate from the frozen List layout fix. No dependency mutation has been made.

The current candidate lock installs Vitest4.1.11 and @vitest/mocker4.1.11. Its npm audit reports two moderate package entries. The primary GitHub advisories identify @vitest/mocker4.1.12 as the backported patch:

- [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8): unauthenticated mock registration can inject code into modules served by the development server.
- [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp): Windows backslash traversal bypasses the redirect allowlist.

This concerns development test tooling. It is not evidence of a production exploit or compromised data. The active acceptance fixtures use the loopback Hono diagnostic server rather than a Vitest mocker development server. Upgrade the narrow Vitest package family in a separate dependency-isolated checkout, verify the lock delta and installed versions/audit, run the full suite and deterministic package build, then follow the normal release process. Do not mutate shared node_modules used by the current List test/build or existing fixtures.

Evidence: candidate List audit JSON and the two primary advisories read on22October2026. Full builder QA remains open.
