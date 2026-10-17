# Publication font recovery and CMS image removal

Source/build verification complete; staging and matching WordPress native acceptance pending. Full customer QA remains incomplete.

A native publication-preview request returned 422 publication_compile_failed / fetch failed before findings validation or snapshot creation. Google CSS/WOFF2 fetches now have a 10s attempt timeout and one selective retry for transient transport/timeout and HTTP 408/429/5xx. Exhausted failures return retryable 503, Retry-After 5 and safe dependency/stage/category fields. Strict host, redirect, type, signature and byte limits remain enforced. The preview message confirms the saved draft and names the retry action; it does not expose arbitrary server details. Original runtime transport cause remains unproven.

CMS image removal now stops click propagation so the newly rendered upload dropzone does not open a chooser. Real Preact/CMS regression tests fail against the original handler and pass with the fix. Upload/Library controls remain covered.

Validation: final two clean exports of 93dbaeb plus eight approved source/test files build successfully; all 11 stable outputs match. Original main working 11 remain exact. Native Node strip-only imports and the gallery server passed. A first candidate with TypeScript parameter properties was superseded before deployment; final classes use declared fields and assignments. Gallery: 30/30 behaviors, 24/24 PNG and decoded pixel exact matches. Canonical baselines reviewed with builder source hash updated only. Full isolated suite: 206 files passed, 2 skipped; 2339 tests passed, 5 skipped.

Evidence: font-media-build.json; tests-font-media-final-20261017.log; gallery/font-media-final/capture.json; native/staging-5da-publication-review-response.json; native/staging-5da-cms-image-remove-dialog-before.json. Production unchanged.
