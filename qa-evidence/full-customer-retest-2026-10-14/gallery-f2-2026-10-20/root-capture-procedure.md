# Exact-f2 gallery capture handoff

- Revision: `f2bcf2ef6233fd03df3a93c4d5ab1ea022cc58f1`
- Archive: `/private/tmp/pagecraft-gallery-f2-UEEP2a`
- Loopback gallery: `http://127.0.0.1:4944/internal/components`
- Fixture contract: `tools/qa-ui.mjs`; fictional in-memory accounts/data, loopback only, reset on restart, no Supabase/SMTP/production credentials.
- Capture directory: `/private/tmp/pagecraft-gallery-f2-UEEP2a/qa-evidence/gallery-f2-2026-10-20/captures`
- Current listener PID: `42290`
- Shutdown after root closes the tab: `kill -TERM 42290`

The retained failure is exact: `tests/ui-baselines.test.mjs` reports only `builder.html` changed. Reviewed source SHA-256 is `606926347d429046342a36580ad2be53eb7ad0df86f0657a4e22c8bc1965735a`; candidate SHA-256 is `84fe4198158862580536bda0dc76b202436b35ffd880be407063a9561285bc84`.

## Built-in browser capture

Open the gallery URL in the built-in browser and keep that selected tab as `tab`. Run the sanctioned behavior driver and capture helper in the same browser session:

```js
var galleryChecks = await import('/private/tmp/pagecraft-gallery-f2-UEEP2a/tools/gallery-behavior-checks.mjs');
var galleryResults = await galleryChecks.runBehaviorChecks(
  tab,
  'http://127.0.0.1:4944/internal/components'
);
var galleryFailures = galleryResults.filter(result => !result.passed);
if (galleryFailures.length) throw new Error(JSON.stringify(galleryFailures, null, 2));

var galleryCapture = await import('/private/tmp/pagecraft-gallery-f2-UEEP2a/tools/capture-ui-gallery.mjs');
var galleryDirectory = '/private/tmp/pagecraft-gallery-f2-UEEP2a/qa-evidence/gallery-f2-2026-10-20/captures';
await galleryCapture.captureGallery(tab, galleryDirectory, galleryResults);
```

This executes all 15 checklist cases for Cloud and Builder, producing 30 behavior records, then captures all 24 schema-2 images at 1440px and 768px.

## Compare without accepting

```bash
cd /private/tmp/pagecraft-gallery-f2-UEEP2a
node tools/ui-baselines.mjs compare qa-evidence/gallery-f2-2026-10-20/captures
```

Review all 24 captures. Inspect every changed image and each red diff in `captures/diffs/`. Do not record if any behavior fails, any image is missing, or any visual difference is unreviewed.

## Record only after root review

After root explicitly reviews the images and comparison:

```bash
cd /private/tmp/pagecraft-gallery-f2-UEEP2a
node tools/ui-baselines.mjs record qa-evidence/gallery-f2-2026-10-20/captures --reviewed
node tools/ui-baselines.mjs check
```

The isolated archive then contains the reviewed manifest and PNG candidate for root to diff and integrate. This task has not recorded or accepted any baseline.

## Retained evidence

- `ui-baselines-failure.log` and `.exit`: exact source-hash gate failure.
- `source-review.json`: only `builder.html` source fingerprint changed.
- `npm-ci.log` and `.exit`: clean dependency install, 0 vulnerabilities.
