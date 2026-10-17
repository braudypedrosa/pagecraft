# Validate publication content before fetching webfonts

Source verification complete; staging native acceptance pending. Full customer QA remains incomplete.

An invalid draft already has actionable findings after render. The hosted preview route now returns those structured findings before fetching Google Fonts. This avoids hiding fixable content errors behind an unrelated font availability failure. Valid and warning-only drafts retain the strict bounded font fetch and retryable dependency response. Invalid drafts create no snapshot and perform no font fetch.

Verification: targeted hosted regression asserts HTTP 422, exact finding target, zero font calls and no snapshot. Existing valid-draft HTTP 503 dependency test remains green. Two isolated exports of 1935ba3 plus the exact two files built successfully; 11 generated outputs match across exports and all nine tracked generated outputs equal 1935ba3. Thus the matching WordPress editor package may retain exact 1935ba3 provenance; this follow-up changes Cloud server behavior only. Raw Node imports and canonical 24-image/28-source baseline check pass. Full isolated suite: 206 files passed, 2 skipped; 2340 tests passed, 5 skipped. Main working 11 remain exact.

Evidence: publication-validation-order-build.json; tests-publication-validation-order-20261017.log. Original font transport cause remains unproven. Production unchanged.
