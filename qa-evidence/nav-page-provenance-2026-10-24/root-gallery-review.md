# Root gallery review

Root approved a source-fingerprint-only refresh for `app/src/ui/inspector/Lists.tsx` after reviewing the complete product diff.

- Fresh built-in browser capture: 24 of 24 reference images matched with zero changed pixels.
- Representative `builder-fields-768` rendering was reviewed.
- All 12 generated Cloud and Builder gallery HTML variants are byte-exact against base `b45d98f`.
- The 30 behavior checks reuse the accepted `component-rename` run because the generated gallery HTML is byte-exact. Its initial timing sample and successful isolated recheck remain in that evidence.
- Only the `Lists.tsx` source fingerprint changed. The 24 PNG files, their hashes and dimensions, capture provenance, behavior records, capture code, and the other 29 source fingerprints remain byte-exact.
- Tab 54 was closed after capture. Metrics and media overrides were cleared and CPU throttling was restored to rate 1.

This approval does not claim a new behavior run or permit baseline image replacement.
