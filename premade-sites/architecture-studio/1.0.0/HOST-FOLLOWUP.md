# WordPress compatibility blockers

Scope: proposed host follow-up, separate from template authoring. No WordPress source edits,
commits or deployment have been made. Keep the unrelated dirty WordPress checkout intact.
Reproduction uses the clean committed WordPress baseline and editor recorded in
`evidence/tested-hosts.json`.

## Preserve document object maps

1. Import the representative package into an isolated site; open Home in Pagecraft.
2. Select the project record and set padding-top to 12px Mobile, 18px Tablet, 24px Desktop.
3. Save until the UI says Page saved; reopen the editor.
4. The saved node has `css: {d: [], t: [], m: []}` and the overrides are gone.

Read-only proof: `wp eval-file tools/template-wordpress-audit.php 8` found 54 affected maps.
The initial empty component `vals` map caused the same loss for edited titles and images.
Explicit initial instance content avoids that initial case, but Reset to defaults remains unsafe.

Proposed fix: preserve schema-defined object/list distinctions at every WordPress document JSON
boundary. `PageEditor::load()` currently uses associative JSON decoding; the REST response then
serializes empty objects as arrays. Check save, restore, global-element editing, shared settings,
and imported document rewriting too. Do not globally convert every empty array to an object:
children, pages, menu items and other lists must remain arrays. Do not change package checksums
or generic canonical JSON semantics to conceal the issue.

Regression proof: import a document with empty maps, edit an instance field and initially empty
breakpoint style, save, reload through REST, publish locally, and verify persisted frontend
values. Include reset-to-defaults followed by a new edit and a revision restore.

## Preserve native ARIA attributes

The published 390px navigation toggle is a button with no accessible name. Its authored
`aria-label` and `aria-controls` disappear after WordPress sanitation. The menu opens and
`aria-expanded` is added by runtime, which does not repair the missing name.

Proposed fix: explicitly allow supported ARIA attributes in `FallbackCompiler::allowedHtml()`;
the current `aria-*` entry does not preserve these attributes in the tested WordPress version.
Retain the sanitizer. Regression-test navigation, form labels/status, tabs and accordion
relationships, including browser keyboard operation on the resulting frontend.

## Open existing managed pages directly

The Pages list's Edit with Pagecraft action always sets `pagecraft_choose=1`, including on an
already imported managed page. It opens Blank Page / Template / Cloud Import choices.
The existing `admin.php?page=pagecraft-editor&post=8` route correctly loads the design.

Proposed fix: use the existing editor route for managed pages; preserve explicit conversion
and starter choices for unmanaged WordPress content. Verify both entry points and no content loss.

## Local form receiver

Cloud requires a complete HTTPS form action before publishing. A local receiver is supplied in
`tools/template-qa-receiver.ts`, bound only to loopback and sending no email. The existing Local
certificate was rejected by the built-in browser. Complete certificate trust through the user's
normal local setup before a form submission test; no warning bypass has been performed.

All fixes require fresh representative checks in both hosts, then the six-page build and final
package acceptance. No current host acceptance record or final user approval is present.

## Implemented local follow-up — 2026-09-07

The user authorized these fixes and they are now implemented in the isolated
`pagecraft-wordpress-template-qa` worktree on `bp/template-host-compatibility`.
The original dirty WordPress and Cloud checkouts were not edited.

- DocumentJson restores schema-defined object maps at the initial editor bootstrap, REST responses,
  import/save/global-document serialization, and design-settings responses. Generic CanonicalJson
  retains its original semantics; page/child/item arrays stay lists.
- The fallback sanitizer explicitly preserves supported ARIA attributes. Real KSES integration and
  keyboard testing verify the mobile menu's name, controls, expanded state, Enter, and Escape.
- Managed page row actions and the Gutenberg toolbar route to the existing editor; unmanaged pages
  retain the start chooser. Page-list links were verified in the built-in browser.
- `npm test` passes, including the new document-map regression and deterministic package archives.
  `tests/wordpress-accessibility.php` passes against WordPress 7.1 / PHP 8.5.2.
- Built-in browser save/reopen preserved 24px desktop, 18px tablet, and 12px mobile padding. Resetting
  a component to defaults, reopening, and setting a new title also persisted.

Exact baseline, editor source, and local patch hashes are in evidence/wordpress-host-patch.json.
These tests used the representative package. The expanded six-page package requires its own
acceptance record. No plugin release, merge, or production deployment occurred.

## Native library media after save

The isolated v4 editor patch resolves `asset:<id>` to its native media URL before sending fallback HTML to WordPress. Without this step sanitization reduces the source to a bare ID, breaking the published image. Both replacement and restoration passed native save/reopen and frontend load checks. This host change remains isolated and unreleased; see `evidence/wordpress-host-patch-v4.json`.
