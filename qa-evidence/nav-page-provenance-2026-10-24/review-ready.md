# Nav page provenance review

Base: `b45d98fb66415dfd1d7319c60996657b8090874e`

The Nav item now stores optional Pagecraft `pageId` provenance separately from WordPress `objectType`, `objectId` and `anchor`. Deleting a page stamps legacy Nav rows only while their exact portable href resolves to that still-existing page. Missing targets remain in Page mode with their href and anchor unchanged. Relative `.html` values without provenance remain Custom URL.

Checks:

- RED: 3 failed, 1 passed before implementation.
- Focused: 5 files, 743 tests passed.
- TypeScript: passed.
- No build, generated output, baseline, browser, commit or push was run.
