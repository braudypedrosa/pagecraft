# Action feedback

Every foreground processing action must enter the shared action lifecycle. This is an app-wide contract for the portable builder, Cloud editor and management screens, including legacy authentication and WordPress connection pages. Notification copy is text, never HTML.

## Use the shared lifecycle

Use `installActionFeedback().run(options, work)` from `shared/action-feedback.js`. It starts feedback before calling `work`, catches synchronous and asynchronous failures, restores the trigger, and returns a discriminated result. `success` is required and is shown only after the work completes. Return `false` or throw `AbortError` for user cancellation; neither produces a success. Check `result.status` before navigation or other follow-up work.

```ts
const result = await installActionFeedback().run({
  key: 'project-backup',
  button,
  pending: 'Preparing backup…',
  success: 'Backup ready. Download started.',
  paint: true,
}, () => buildAndDownload());
```

Use a stable key where re-rendering can replace the trigger. Duplicate activation of that job is blocked until settlement, while unrelated actions remain available. A retry replaces the previous error notification. `paint: true` yields a frame before CPU-heavy work; omit it for clipboard/file-picker actions that need browser user activation.

Preact uses `useProcessingAction` so Preact retains ownership of button rendering. `useImageUpload` applies the same lifecycle to CMS/SEO image fields, inspector images/backgrounds and galleries, with disabled upload/replace choices, drop-target state and one result per batch. Successful files survive a partial upload failure; only failed filenames are reported for retry.

`begin` remains the lower-level interface for real streamed progress, FileReader events and native navigation. Those adapters must settle every success, failure and cancellation path. Never wrap individual fetches globally: one user action can contain several requests, and the server may commit before a connection is lost. Never automatically repeat a mutation.

## Behavior

- Show the action verb, spinner and `aria-busy` immediately; prevent duplicate activation while pending.
- Confirm the actual outcome only after the storage/server acknowledgement. A download starts a browser download; it cannot prove a file was saved to disk.
- Keep failures visible until dismissed or retried. Restore controls and preserve user input. Network loss during a mutation can leave its result uncertain; tell the person what to check before retrying.
- Success confirmations dismiss after five seconds, paused during hover or keyboard interaction.
- Feedback belongs to the active dialog, remains keyboard accessible and uses live regions without stealing focus. Form validation also retains its inline error.
- Ordinary POST forms are enhanced centrally by `shared/account-actions.js`. Custom handlers prevent their submit event and own the lifecycle. OAuth and WordPress consent keep native navigation, preserve the clicked submitter value and restore controls on browser Back.
- Background work has contextual feedback: autosave uses the existing draft status, bootstrap uses the loading screen, and dashboard preview polling stays quiet. Opening a picker or switching an already-loaded tab is not processing. Site creation keeps its real server progress events.

## Coverage

| Surface | Processing actions |
| --- | --- |
| Builder | Explicit save, save before leaving, settings save, publish, version loading/restoration, share link |
| Exports | Preview build, page/all-pages/site archive, SEO/content/project JSON, HTML copy, file import |
| Media and inspector | Library upload/deletion/pruning, image/background/gallery uploads, CMS/SEO uploads, image-size detection |
| CMS | Collection creation/deletion, schema and entry save/delete; inline saving/saved/retry states |
| Management | Account/profile/password, site settings/deletion, people/invitations, integration connection/list/sync/disconnect |
| Submissions | Remote navigation/refresh, deletion and CSV export |
| Authentication/setup | Sign-in/reset/signup, legacy magic-link and first-site creation, OAuth/WordPress authorization |

Synchronous edits keep their immediate UI update and existing confirmation; autosave reports their persistence. Adding a new foreground processing action requires the shared lifecycle and a failure/recovery check.

## Verification

`npm test` covers promise results, cancellation, duplicate jobs across re-renders, independent concurrent actions, preserved input, partial image batches, inspector detection, server validation, native OAuth/consent, notification timing/dialog placement, CMS persistence, submission refresh and export errors. `node tools/demo-site.mjs` verifies the portable build.

For an isolated browser check with real HTTP and memory storage:

```sh
CMS_QA_PORT=4943 CMS_QA_SAVE_DELAY_MS=2000 CMS_QA_FAIL_FIRST_SAVE=1 CMS_QA_HISTORY_DELAY_MS=3000 CMS_QA_FAIL_FIRST_HISTORY=1 node tools/cms-qa-server.ts --local-only
```

These options cannot run in production. Staging verification must confirm `/__deployment` matches the deployed commit.
