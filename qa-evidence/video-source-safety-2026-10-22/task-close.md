# Task close: video source validation

Internal evidence record.

- Date and timezone: 2026-10-22, Asia/Manila
- Client / project: Braudy / Pagecraft
- Task reference: native Video invalid-source issue
- Status: awaiting native review
- Authorized scope: Core video source validation and rendering, focused tests, generated outputs and evidence
- Environment: isolated local worktree based on 37f65d4b83de12d6959bfa982c935bc945e31461
- Working source: /Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/video-source-37f65d4

## Work performed

- Defined and retained the valid provider, media-file, relative-media, Pagecraft asset, data-video and custom HTTP(S) embed contract.
- Rejected executable, protocol-relative, credential-bearing, malformed and unsupported source URLs before media markup is generated.
- Added a request-free unsupported-source placeholder for edit and public output while leaving the authored source draft unchanged.
- Investigated playsinline. Unmuted non-autoplay file output currently omits it because the attribute is coupled to muted or autoplay. No speculative change was made.
- Delivery state: local worktree only. No commit, push or deployment.

## Verification

| Check | Environment or scope | Result | Evidence |
|---|---|---|---|
| RED | focused source safety | pass | 17 failed, 8 passed |
| Focused GREEN | source safety and existing video controls | pass | 44 tests |
| Related tests | seven render and video files | pass | 778 tests |
| Typecheck | current source | pass | npm run typecheck |
| WordPress golden | check only | pass | 1 passed, 29 skipped, no update |
| Full suite, first attempt | local | fail | unrelated PGlite and submission-cap timeouts |
| Isolated timeout suites | local | pass | 30 tests |
| Full suite, retry | local | pass | 257 files passed, 2 skipped; 2,693 tests passed, 5 skipped |
| Ordered builds | builder then editor, twice | pass | four exits 0, ten outputs present and identical |
| Final freeze | source, test, unchanged golden and ten outputs | pass | 13 entries verified |

- Remaining limitations: Root owns UI feedback and final native acceptance. Malicious strings were never executed in a browser. Full QA remains open.

## Time evidence

| Work item | Duration | Basis | Reference |
|---|---|---|---|
| Implementation and verification | unknown | no timer supplied | this task |

- Tracked or explicitly confirmed total: unknown
- Estimated time: not prepared
- Excluded time: root-owned native verification
- Billing state: not prepared

## Next action and handoff

- Outstanding work: Restart the native harness from final generated output and confirm invalid text and unsafe URLs show the placeholder without iframe requests, while valid provider, file and custom embed sources still render.
- Owner / dependency: root
- Restart point: qa-evidence/video-source-safety-2026-10-22/verification.json
- Client context: no durable client-context change

## Client-facing summary

Invalid Video sources now show clear guidance without creating iframe or video requests, while supported providers, media files and custom embeds keep their existing output. Local focused, related and full tests pass; final native verification remains pending.



## URL normalization follow-up

Node URL parsing confirmed that two leading backslashes, backslash-slash, and slash-backslash all normalize to cross-origin network URLs. Embedded ASCII tab and newline characters inside a JavaScript scheme are removed during parsing. The final guard rejects those shapes plus leading percent-encoded ASCII controls, while retaining relative filenames containing encoded spaces such as `my%20clip.mp4`.

- Follow-up RED: 7 failed and 26 passed.
- Final focused checks: 52 passed.
- Final related checks: 786 passed.
- Final full suite: 2,701 passed and 5 skipped.
- Refreshed two ordered build pairs: four exits 0 and ten artifacts byte-identical.
- Final freeze: `freeze-final-13.sha256`, 13 entries verified.
