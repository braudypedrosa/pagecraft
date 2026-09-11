# Component gallery and visual baselines

Open [the staging component gallery](https://staging.itspagecraft.com/internal/components) while signed in. It is deliberately absent from customer navigation. Production leaves the route disabled; staging and local development explicitly enable it. Baseline images require the same authentication and editor-host checks. No sample sends site/account writes or changes clipboard contents.

The gallery renders Cloud through its real account shell and route styles. Builder specimens consume the compiled editor's actual style blocks, with the same local product font files. Menus, selects, notifications and dialogs use the existing shared implementations. Gallery-specific CSS owns only composition, navigation and specimen-container sizing; it does not redefine input or button geometry. Specimen markup is representative, not a substitute for testing the consuming application screens.

Choose Cloud or Builder, then Fields, Actions, Tables, Menus, Dialogs or Feedback. Read the sample's role before comparing: full forms are 44px, inspector fields 37px, CMS schema 36px, dense rows 32px and nested toolbar pickers 30px. Multiline fields grow. These intentional densities are not supposed to collapse into one height.

## Baseline coverage

`public/internal-ui-baselines/` holds 24 reviewed PNGs: six families × two hosts × two browser viewport widths (1440 and 768, both 900px tall at 1x scale). Long field pages expand the capture viewport to their measured document height, then restore it. These are Codex built-in browser viewport emulations, not physical-device tests.

| Family | Captured state |
| --- | --- |
| Fields | Focused input with neutral background; disabled and readonly examples; labels, help and validation |
| Actions | A busy action and progress notification; primary, secondary, destructive and disabled controls |
| Tables | First row hovered, next row neutral; compact actions and empty results |
| Menus | Open enhanced select; selected and disabled options; link/button/destructive menu items |
| Dialogs | Open dialog with header, body, footer and corner close |
| Feedback | Persistent error notification and recoverable refresh error |

The behavior checklist additionally covers select Escape/value preservation, dialog focus return, empty footer, unsaved dialog values across resizing, processing state and success/failure recovery, and silent refresh recovery. Success notifications and ordinary keyboard interaction remain interactive examples; the PNG set is not exhaustive state coverage.

## Check and review changes

`npm test` checks every baseline file/hash/dimension and fingerprints the owning UI source files and product fonts. A change to those sources fails the check until baselines are reviewed. This is a source-review gate, not automatic browser rendering in CI. The browser comparison remains an explicit evidence step. Changes within a source file that are behavior-only may still trigger review; do not blindly update its hash.

1. Build the editor (`npm run build`) and open the gallery in the built-in browser on the intended revision. Use an isolated local fixture before deployment; repeat acceptance on staging.
2. Test both hosts against the behavior checklist above. Save an array of `{host, check, passed}` records as `behavior-checks.json` in a fresh capture directory. Failed or missing checks must be resolved before recording.
3. In the built-in browser JavaScript session, pass the selected tab to the supplied capture helper. It loads fonts, uses reduced motion, drives real component states, checks overflow, captures at both widths and restores viewport emulation. It launches no browser of its own.

```js
var captureModule = await import('/absolute/path/to/pagecraft/tools/capture-ui-gallery.mjs');
var captureDirectory = '/absolute/path/to/new-captures';
await captureModule.captureGallery(tab, captureDirectory,
  await captureModule.readBehaviorChecks(captureDirectory));
```

4. Compare the candidate captures:

```sh
node tools/ui-baselines.mjs compare /absolute/path/to/new-captures
```

Blank captures and dimension changes fail. A changed pixel has a channel difference over 20/255; over 0.1% changed pixels fails. The tool writes red difference images and a JSON summary under the candidate directory's `diffs/`. Small rasterization/caret differences can fall within tolerance. Inspect every reported difference rather than increasing tolerances to hide it. Use the same browser/runtime and capture conditions when possible.

5. View all changed images, check the intended app screens, and only then record:

```sh
node tools/ui-baselines.mjs record /absolute/path/to/new-captures --reviewed
node tools/ui-baselines.mjs check
npm test
node tools/demo-site.mjs
```

The recorder requires a complete 24-image inventory, successful behavior evidence and unchanged sources since capture began. It never generates screenshots or accepts an incomplete set. Commit the reviewed PNGs and manifest with the implementation. The initial set records the current gallery; subsequent sets should always include comparison evidence. Staging acceptance must confirm `/__deployment` before repeating the relevant interactions and image comparison.

## Extending the gallery

Add an example when a shared component gains a meaningful variant. Reuse its production classes and behavior and include any required host wrapper styles. Do not paint a separate “correct” component solely for the gallery. Keep sample data fictional and local. Do not add publish, delete, account-write or external-integration endpoints to demonstrations.

When a real screen drifts but its gallery example does not, first check for missing host wrappers or screen-specific overrides. Expand the representative fixture or add a focused regression, and verify the actual consuming screen on staging. The gallery protects shared foundations; content-dependent layout and third-party service journeys still need their own checks.
