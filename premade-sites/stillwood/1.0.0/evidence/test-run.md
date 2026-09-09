# Stillwood test-run evidence — 2026-09-09

Package SHA256: a7ac90c585e66d9978565e6c6db286caae7c187b478ddf42e80e676f89c73b3d
Template checkout base: 0f7134b9560ae1cc53d34a88d25cf26ca608c944 (working changes present).
Cloud editor HTML SHA256: 4e69d120107926f5f07beb363e11fbcedd6d9b8d73a18d7760aca066d85b4c2d.
WordPress customized editor HTML SHA256: e69cb42039af506eb14b84ee35cd0d16973d0d965ba397386411cb9de1ee6aa3.
Cloud editor source: /tmp/pagecraft-cove-fixes/index.html (0.2.15 candidate).
WordPress host: separate /tmp/stillwood-wp installation, stillwoodqa_ database table prefix, Pagecraft theme and builder/importer copied from current LocalWP QA. Not a production installation.
Cloud host: checkout createApp with disposable MemoryStore and fixture identity, port 4929. This is not a Supabase sign-in test.

## Observed checks

- Native build and package consistency check pass. Nine pages, six packaged assets, no custom CSS.
- Fresh Cloud import through Add new site > Premade templates > Stillwood opens native editor. Final revision imported as s2.
- Final WordPress import/reimport updates nine managed pages, creates zero duplicate pages, retains six media assets and one menu. Homepage ID 11. Fresh fixture includes WordPress default pages; the imported collection itself has nine.
- Shared tokens, original mark, imagery and page destinations survive import. WordPress pretty-permalink configuration enabled in this separate fixture; existing Cove host unchanged.
- Final Cloud editing test: navigate to testimonial position 3 of 4, change quotation to “Long breakfasts became our favourite ritual.”, blur and reload. New copy persists.
- Final WordPress editing test: navigate to position 4 of 4, change quotation to “Every morning brought a new favourite corner of the garden.”, blur, Save page and reload. New copy persists. Active slide stayed at position 4 during edit.
- Earlier revision test also confirmed Cloud active position stayed at 3 during edit. No decorative drop hint appears in the current editor's empty image overlays.
- Final package-rendered preview and WordPress frontend: 72 page/viewport checks (nine pages x 390/768/1024/1440 x two surfaces). All had exactly one H1, no document-width overflow, and no completed image loads with zero natural width. This automated DOM check is not a claim that every image was loaded before each immediate sample.
- Desktop homepage visually inspected in built-in browser, including full-page composition. Corrected contrast in dark itinerary, centered review headings, footer link stacking, intrinsic image dimensions, and collection heading order in source.
- WordPress mobile menu opens and The cabins link reaches /cabins/ with the correct H1.
- WordPress FAQ Can I bring a dog? toggles its native details open.
- WordPress Waterline gallery opens its lightbox; Next image shows the interior; Close returns to page.
- Forms retain arrival/departure date fields and guest selector. Search has no name/email fields. All endpoints intentionally absent and controls explicitly disabled.

## Boundaries / remaining release acceptance

This is a functional design test-run draft, not full release certification. The complete editing stress matrix (global token changes, replacement imagery, shared versus instance styles, duplication/reorder/deletion, long headings and responsive inspector on both hosts), exhaustive keyboard/console checks and Cloud hosted publish output are not signed off. User visual selection and package approval are not recorded. Cloud publish is blocked by intentionally unconfigured forms; no fake endpoint was added. No production release or catalog promotion occurred.

QA copy edits exist only in disposable imported sites; the source package retains its original sample reviews.
