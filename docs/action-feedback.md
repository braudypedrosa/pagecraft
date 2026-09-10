# Action feedback

Explicit asynchronous actions use `installActionFeedback()` from `shared/action-feedback.js`. The portable builder installs it through `PC_UI`; Cloud management pages load the serialized boot script. Notification copy is always text, never HTML.

- Show the action verb and a spinner immediately. Set `aria-busy` and prevent duplicate activation until the request settles.
- Confirm completion only after the storage or server response. Network loss can leave the result uncertain; do not claim that nothing changed or automatically repeat destructive requests.
- Keep failures visible until dismissed or retried. Restore controls and preserve user input. Confirmations dismiss after five seconds, paused during hover or keyboard interaction.
- Place feedback within the active native or builder dialog so it remains keyboard accessible. Live regions announce results without stealing focus; form validation focuses its inline error.
- Autosave continues to use the draft status in the header. Do not create a toast for every keystroke or ordinary tab selection.

## Current integration

CMS collections and entries show saving, saved, and retry states next to the save button as well as a notification. Shared image upload/removal, publish, version restoration, explicit save, leaving the builder, export/import, page and component removal, account/site/people POST forms, Uplisting actions, site creation, submission refresh, and CSV export use this feedback. Existing builder toast calls use the same accessible notification presentation.

Custom asynchronous forms prevent their submit event and own their request lifecycle. Ordinary Cloud POST forms use `shared/account-actions.js`, preserving server validation notices and redirect destinations. OAuth retains native navigation and restores the button when returning through browser history. Site creation retains real server progress events.

## Verification

`npm test` covers pending state, duplicates, retry, preserved inputs, server validation, OAuth history return, notification timing and dialog placement, CMS persistence, submission refresh, and export errors. `node tools/demo-site.mjs` verifies the portable demo build.

For an isolated real-browser recovery check:

```sh
CMS_QA_PORT=4943 CMS_QA_SAVE_DELAY_MS=3000 CMS_QA_FAIL_FIRST_SAVE=1 node tools/cms-qa-server.ts --local-only
```

The local fixture uses memory storage, delays saves, and rejects the first save once. Open its printed URL, edit a collection, save, and retry the retained input. These options cannot run in production. Staging verification must also confirm `/__deployment` matches the deployed commit.
