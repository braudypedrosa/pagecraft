# Task close — Video URL parsing and relevant controls

- Date and timezone: 2026-10-17, Asia/Manila.
- Project: Pagecraft full customer retest.
- Status: partial; code and isolated checks pass, staging acceptance pending.
- Scope: development/staging fixes and matching local WordPress QA. No production promotion.
- Source: /Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft, development; parent 2a975d8997fedbb6939ba7a093cc3a7c7f6cc474.

## Work performed

A valid shared YouTube URL with another query parameter before v incorrectly rendered a watch-page iframe. Shared URL parsing now recognizes the provider and video ID independently of query order. Direct players and click-to-load players use the same parser. Exact provider hostnames avoid lookalike matches. Existing MP4, generic embed, empty, and youtube-nocookie embed paths remain intact.

The inspector now offers click-to-load only for supported embedded providers with autoplay off. Muted is hidden while autoplay forces silence; the Autoplay tooltip explains that behavior. Both stored preferences return unchanged when autoplay is disabled.

## Verification

- Native before evidence: QA Modules, reordered query, raw watch-page iframe and visibly broken player. [Screenshot](native/staging-2a-youtube-query-before.jpg).
- Independent dual exports: source-only overlays, clean dependency install, editor and demo build, deterministic eleven generated outputs.
- Focused checks: 24 passed per export, including the exhaustive conditional-control registry.
- Full isolated suite: 208 files passed, 2 skipped; 2,368 tests passed, 5 skipped. Golden guard passed without update.
- Main original generated working files: eleven byte-exact against the original preservation record.
- Main audit: production dependencies have zero findings. Three high findings remain in the development dependency chain; no speculative major downgrade or override was applied.
- [Build evidence](video-build.json). Actual staging/native acceptance follows the commit and deployment.

## Limits and handoff

Provider iframe creation and configuration do not prove actual provider playback. Broader Video Style/Advanced, unlisted/provider variations, and complete customer QA remain open. Continue on the dedicated QA site, restore all temporary module settings, then install the matching WordPress QA package only after CI and strict protected-state guards.

Tracked time: unknown. Billing: not prepared.
