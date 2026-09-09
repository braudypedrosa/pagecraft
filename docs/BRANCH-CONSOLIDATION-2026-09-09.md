# Development branch consolidation

The user requested wrapping up unfinished branches and PRs and returning to development. No development branch existed; a new `development` branch now consolidates current work. Existing `main` is not deployed or rewritten by this operation.

Dirty worktrees were backed up before checkpoint commits. Branch tips are retained with `archive/2026-09-09/` tags before branch retirement. Worktree directories are retained detached to preserve local preview/runtime files.

| Previous branch | Preserved commit | Disposition |
| --- | --- | --- |
| `bp/accounts-dashboard` | `ae6779b` | Integrated by ancestry |
| `bp/cloud-integration-api` | `66df224` | Integrated by ancestry |
| `bp/cloud-page-library` | `dcf5169` | Integrated by ancestry |
| `bp/cloud-platform-release` | `a184adf` | Integrated by ancestry |
| `bp/cloud-review-fixes-20260908` | `83f5a5f` | Integrated by ancestry |
| `bp/cloud-ui-release-20260908` | `06d1154` | Integrated by ancestry |
| `bp/connected-v1-checkpoint` | `f99bda5` | Integrated by ancestry |
| `bp/cove-compatibility-fixes` | `06a8692` | Integrated by ancestry |
| `bp/editor-0.2.3` | `6f66720` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/editor-package-0.2.0` | `92e355b` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/editor-package-0.2.1` | `f9454ed` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/editor-package-0.2.2` | `33cd38c` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/editor-v0.2.4` | `795868d` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/editor-v0.2.5` | `00cf70b` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/issue-10-manual-cloud-import` | `05d128f` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/issue-11-wordpress-qa-release` | `7e3950c` | Integrated by ancestry |
| `bp/issue-6-theme-generated-assets` | `01c4197` | Integrated by ancestry |
| `bp/issue-7-wordpress-editor-pages` | `0c4735b` | Integrated by ancestry |
| `bp/issue-8-native-wordpress-menus` | `61943b1` | Integrated by ancestry |
| `bp/issue-9-wordpress-media-library` | `9ff8a9a` | Integrated by ancestry |
| `bp/landing-page-redesign` | `30afbcf` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/premade-sites` | `64e6016` | Integrated by ancestry |
| `bp/shared-editor-0.2.14` | `93f1ed2` | Integrated by ancestry |
| `bp/shared-editor-page-library` | `7c2fa20` | Integrated by ancestry |
| `bp/shared-editor-review-panel` | `4fcabbc` | Integrated by ancestry |
| `bp/theme-builder` | `1e0515c` | Integrated by ancestry |
| `bp/wordpress-extract` | `923a875` | Archived historical line; superseded by the current shared editor, standalone marketing site or split WordPress repository |
| `bp/wordpress-native-v1` | `5d59e3e` | Integrated by ancestry |

## Verification and release boundary

Pagecraft: 1,132 tests passed, five skipped; demo build produced zero findings. WordPress: native PHP/ownership/import tests and deterministic package checks passed. The shared editor uses one new 0.2.16 development archive, replacing the conflicting 0.2.15 sources without rewriting their historical commits. New integration changes are not a production deployment or a public plugin release.

Pagecraft PR #22 predates the repository split; its commits are already ancestors of the development integration. It is superseded, not represented as completing its original hosted-release acceptance. WordPress CI now lives in the dedicated WordPress repository.
