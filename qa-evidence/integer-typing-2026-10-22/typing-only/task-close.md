# Task close — Integer sequential typing, candidate86

Date: 2026-10-22, Asia/Manila. Exact base: `218f11545451cbac7ad1d8ed9e08245258b57a25`.

Root accepted the one-line source guard and five regression cases. Integer controls now avoid assigning an already-equal number value during an input event, preserving the browser's intermediate decimal editing buffer. Actual normalization still rewrites changed fractional or out-of-bound values. No Core, compiler or dependency source changes.

The sequential test helper explicitly models the native hidden trailing-decimal buffer because jsdom cannot reproduce it. It caught three failures before the guard, then all five cases passed. Combined focused tests pass 26 cases. Final typecheck and diff check pass. Initial test callbacks returning dispatch-event booleans failed typechecking and were corrected; the earlier typecheck report was corrected to root. This is not native acceptance.

The full suite passes 2,601 tests, with five skipped. One expected failure remains: Controls.tsx requires a reviewed gallery baseline. Eleven generated artifacts match across two correct-order builds. Demo has zero findings. Core, builder, public snapshots, WordPress golden and packaged compiler/runtime are unchanged. The 22-entry source/test/reference/assets manifest is frozen.

Audit exits 1: newly reported moderate sanitize-html 2.18.0 recursion advisory GHSA-c9rx-x947-fp3h, fix available in 2.18.1. The dependency and lock are unchanged; root was notified. Audit is not green.

Root owns actual built-in-browser typing verification, gallery capture/review, baseline recording, advisory disposition and release. Fresh fictional harness is preserved at http://localhost:4982/edit/s1, PID 82494/session 7406. Only the port changed from the trusted85 harness. Prior harnesses and native85 evidence are untouched. No Main/browser/WordPress/baseline record/commit/push/deploy actions by this worker.

Status: ready for bounded native review with gallery and audit gates open. No production-readiness claim. Work time unknown; billing not prepared.
