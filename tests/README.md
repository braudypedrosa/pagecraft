# WordPress test tracks

## Static checks

```bash
bash wordpress/tests/lint.sh
```

This validates every PHP file in Pagecraft Theme, Pagecraft Builder, and the WordPress test harness, then parses `theme.json`. It also creates a real deterministic `.pagecraft-page.zip` and proves native-page creation, split content-hashed asset storage, trusted runtime selection, revision-before-replace, revision-backed global header/footer storage, clean internal routes, tamper/CMS/traversal rejection, exact per-route enqueueing, and plugin-disabled theme fallback behavior.

Media coverage verifies package hashes and actual file types, rollback after a failed page import, content-hash deduplication, native attachment metadata, alt text, captions, responsive sources, local document/HTML/CSS references, and deletion protection from both current records and revisions.

Manual cloud-import coverage verifies PKCE authorization, encrypted WordPress credential storage, short-lived bearer access, project/page browsing, exact package-byte downloads, server revocation, expiry recovery, and the absence of webhook, polling, or background-import hooks.

The same contract also verifies the nonce/capability-gated editor routes, explicit conversion marker, optimistic save conflicts, revision-backed embedded-editor saves, refreshed native fallback output, and native WordPress menu conversion. Menu coverage includes page-backed links, automatic slug changes, anchors, hierarchy, classes, XFN relationships, idempotent full-site reimport, Pagecraft round-trip editing, and explicit single-page insertion.

The release gate also parses the same files with the exact required runtime:

```bash
bash wordpress/tests/php81-lint.sh
```

That check uses the WordPress 6.6 / PHP 8.1 container, so newer host-PHP syntax
cannot hide a compatibility failure.

## Private package checks

```bash
bash wordpress/tests/packages.sh
```

This proves the Builder/Theme archives are repeatable, have the required top-level directories, exclude test-only dependencies, retain the intentionally non-destructive uninstall contract, and cannot accidentally ship the retired Connector runtime.

## Integration checks

The Connected staging/production Docker matrix is preserved on `bp/connected-v1-checkpoint` and is not an active release gate. A new single-site Pagecraft Theme matrix will be added with native package import, page ownership, menus, media, editor, fallback rendering, and uninstall-retention coverage under Issue #11.
