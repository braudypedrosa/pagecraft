# Root gallery review

- Root approved a `builder.html` source-fingerprint-only manifest update after reviewing the final candidate build.
- The 12 actual gallery HTML outputs, six sections for Cloud and Builder, are byte-exact against base `55daf136`. See `gallery-html-compare.json`.
- The complete built-in-browser capture contains all 24 expected PNGs. `tools/ui-baselines.mjs compare` passed 24 of 24 with zero changed pixels. See `gallery-native-complete/capture.json` and `gallery-native-complete/diffs/results.json`.
- Root visually reviewed the actual `builder-actions-768.png` capture.
- The 30 prior behavior records were retained because the 12 rendered gallery HTML outputs are byte-exact. This is reuse of reviewed behavior evidence, not a claim that the behavior checklist was rerun.
- The first partial capture in `gallery-native/` stopped after four images when the keyboard adapter interrupted the capture. It has no complete-capture status and was not used for acceptance. The later `gallery-native-complete/` inventory is the accepted capture.
- CPU reset evidence for the accepted browser tab is recorded in `gallery-native-complete/root-cpu-reset.json`.

## Manifest change

- Previous manifest SHA-256: `8dfd68f22832af7cb0705740fda9b3b383d9f9b703c95325f8a0761167061241`.
- Reviewed manifest SHA-256: `925e0f9f605ce0f66cbd8706ac6caa38c6570e86640a581771841ac518f26fee`.
- Updated only `sources.builder.html`, from `5df5d17daa0cdf4fff9f09c3de14873946e9979615d074d9f256a2a9b87c034b` to `2d103a960e4d93ce6edfff676e60da3c1fa0ca7aa0393b57fed12bd0003d6623`.
- All other 29 source entries, 24 image entries and PNG bytes, dimensions, capture provenance, and 30 behavior records are byte-exact against the committed manifest and baseline files.
- No baseline PNG was replaced.
