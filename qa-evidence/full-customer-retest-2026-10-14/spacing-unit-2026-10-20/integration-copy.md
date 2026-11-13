# Integration copy commands

Candidate base: `08b9820890082c86b6a222a71fffd8f7c55c2971`

Run only after confirming Main is still the intended integration target:

```bash
candidate=/private/tmp/pagecraft-spacing-unit-08-vvkcOR
main=/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft

cp -- "$candidate/builder.html" "$main/builder.html"
cp -- "$candidate/index.html" "$main/index.html"
cp -- "$candidate/dist/core.cjs" "$main/dist/core.cjs"
cp -- "$candidate/dist/demo/index.html" "$main/dist/demo/index.html"
cp -- "$candidate/packages/editor/dist/contract.json" "$main/packages/editor/dist/contract.json"
cp -- "$candidate/packages/editor/dist/editor.html" "$main/packages/editor/dist/editor.html"
cp -- "$candidate/packages/editor/dist/runtime.js" "$main/packages/editor/dist/runtime.js"
cp -- "$candidate/packages/editor/dist/templates.json" "$main/packages/editor/dist/templates.json"
cp -- "$candidate/packages/editor/dist/fixtures/page.pagecraft-page.zip" "$main/packages/editor/dist/fixtures/page.pagecraft-page.zip"
cp -- "$candidate/packages/editor/dist/fixtures/site.pagecraft-site.zip" "$main/packages/editor/dist/fixtures/site.pagecraft-site.zip"
```

Verify copied bytes from Main:

```bash
cd /Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft
shasum -a 256 \
  builder.html \
  index.html \
  dist/core.cjs \
  dist/demo/index.html \
  packages/editor/dist/contract.json \
  packages/editor/dist/editor.html \
  packages/editor/dist/runtime.js \
  packages/editor/dist/templates.json \
  packages/editor/dist/fixtures/page.pagecraft-page.zip \
  packages/editor/dist/fixtures/site.pagecraft-site.zip
```

Compare output to `integration.sha256`. Stage only reviewed task files after the hash check. Candidate includes no source change outside `builder.html`.
