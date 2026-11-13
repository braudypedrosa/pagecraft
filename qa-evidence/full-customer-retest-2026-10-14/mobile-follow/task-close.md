# Mobile menu Follow navigation candidate

- Candidate: `/private/tmp/pagecraft-mobile-menu-follow-candidate-75ed-v4`
- Base: `75ed8acb11bb3297d4889f3edade56d6af31807e` plus seven frozen main overlays captured in `candidate-build.json`.
- Scope: candidate-only Core/types/rendering, MobileMenuBuilder/Inspector, and focused regressions.
- Owner correction: MobileMenuBuilder supplies a one-shot exact parent context before opening the shared layout. Direct opens, close, arbitrary restore, mismatches, and deleted owners clear or reject it; no fallback owner scan remains.
- History correction: Undo/Redo alone request preservation. Restore revalidates the exact location, existing component, and unchanged menu reference before retaining context. Style Undo/Redo keeps links and the navigation action; a changed reference clears both safely.
- Defaults: the actual Build-menu UI resolves new Navs to Follow and passes that mode explicitly. The lower-level omitted-mode API remains Custom for legacy compatibility.
- Red: the new history regression restored the colour but lost owner links after Undo.
- Green: 99/99 focused tests across 9 files; TypeScript clean; WordPress hydration regression passed.
- Main guard: 11/11 protected generated files exact; seven frozen source overlays exact.
- Pending root review: candidate patch and later clean builds/full suite/golden/baseline/native checks.
