# Real-screen visual acceptance

The component gallery protects shared component states. It cannot detect a consuming screen's wrapper, legacy override, empty result or long content. Changes to shared UI therefore require both the gallery review and a pass through the actual staging screens.

## Screen coverage

Use the retained, labeled QA Functional Fixes site. Do not modify account details, invitations, integrations or other sites to populate screenshots. Inspect both 1440 × 900 and 768 × 900 browser viewports; use 1024px for intermediate layout checks. These are viewport emulations, not physical-device tests. Phone editing is outside this workflow.

| Surface | Required state checks |
| --- | --- |
| Sites | Loaded previews, site menu, filtered empty result and recovery |
| Site management | Overview, People, Site settings, Integrations empty result and picker |
| Account | Profile, Security, Plan; long identity text and form footer |
| Pages | Populated list, unmatched search, Clear search, Page settings & SEO |
| CMS | List, empty result, schema controls, entry form, pagination |
| Submissions | Form list, inbox, immediate status filtering, empty result, details and refresh |
| Builder | Library families, Navigator, inspector Content/Style/Advanced, Media |
| Project settings | General, Typography, Colors, Classes, Custom code and Advanced |
| Dialogs | New page, Help, History, review/publish; Escape, focus return and preserved unsaved values |

Shared roles: `pc-heading-actions` uses 37px actions; `pc-pagination` uses 32px actions; `pc-list-empty` uses a compact left-aligned result message with 12px body/11px help. A simple empty table cell retains normal table density. Full form submissions remain 44px. Project settings field grids respond to available content width, not the canvas preview setting.

## Capture and compare

Keep actual account screenshots and their metadata in a private `qa-evidence/` directory. They can contain names, addresses, membership or submission content. Do not copy them into `public/`, the component gallery or a public repository. Gallery examples remain fictional.

1. Confirm `/__deployment` matches the intended commit. Reload the agent's QA tabs, navigate using the built-in browser and test each state. Open no production tabs.
2. Capture the stable screen at both widths. Give distinct names to populated, empty and dialog states. `captureAppScreen` observes the real DOM, including the visible submissions iframe, waits for fonts, checks overflow and shared action geometry, and captures a 900px viewport. It makes no account/site writes.

```js
var screenCapture = await import('/absolute/path/to/pagecraft/tools/capture-app-screen.mjs');
await screenCapture.captureAppScreen(tab, privateDirectory, {
  name: 'cms-empty', state: 'Empty QA collection with unavailable Previous and Next',
  width: 768, deployment: verifiedStagingCommit
});
// Capture the 1440px companion, then continue through the screen inventory.
// Restore temporary emulation in a finally block when the pass finishes.
await screenCapture.restoreAppViewport(tab);
```

3. Inspect every screenshot, including alignment, clipped text, radii, cell padding, action placement and content wrapping. Capture named scrolled states for below-fold checks. No screenshot is evidence for content outside its viewport. Record behavior results separately; a PNG cannot establish persistence or error recovery.
4. Record the reviewed private baseline:

```sh
node tools/app-screen-baselines.mjs record /absolute/path/to/private-captures --reviewed
```

5. On a later revision, reproduce the same named states and compare:

```sh
node tools/app-screen-baselines.mjs compare /absolute/path/to/private-baseline /absolute/path/to/new-captures
```

The comparison checks matching inventories/states, approved PNG hashes and the same pixel thresholds as the gallery. A changed account name, relative timestamp or data count may legitimately produce a difference; inspect both images and document the cause. Do not loosen the threshold or claim a changed image passed. The workflow does not mask personal data or automatically render authenticated screens in CI.

The report must state the actual inventory, tested interactions, deployment commit and remaining gaps. Baseline validation is an implementation check; staging browser evidence remains the acceptance authority.
