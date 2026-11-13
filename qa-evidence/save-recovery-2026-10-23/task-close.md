# Save rejection recovery task close

## Outcome

A genuine edit after a rejected save now re-arms the detailed failure dialog. Repeating Save without changing the rejected draft remains deduplicated. WordPress iframe validation remains unchanged and continues to require absolute HTTPS URLs.

## Evidence

- Focused RED: 1 failed and 9 passed. The changed draft's second rejection stayed hidden.
- Focused GREEN: 10 passed. The real Embed textarea produced fresh compiled HTML without `srcdoc`, exposed the new HTTPS validation reason, kept an unchanged retry deduplicated, and saved the corrected HTTPS draft at version 3.
- Full suite after the reviewed source fingerprint refresh: 2,786 passed and 5 skipped.
- Two ordered `build.mjs` then `packages/editor/build.mjs` pairs produced identical hashes for all 10 generated artifacts.
- WordPress golden fixture is unchanged. No PHP, security policy, browser, database, installation, commit, push, or Main checkout change was made.

## Remaining gate

Root owns native WordPress verification of the final rebuilt source, integration, packaging, and release.
