# WordPress test tracks

## Static checks

```bash
bash wordpress/tests/lint.sh
```

This validates every PHP file in Pagecraft Theme, Pagecraft Builder, and the WordPress test harness, then parses `theme.json`.

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

This proves the Builder/Theme archives are repeatable, have the required top-level directories, exclude test-only dependencies, and cannot accidentally ship the retired Connector runtime.

## Integration checks

The Connected staging/production Docker matrix is preserved on `bp/connected-v1-checkpoint` and is not an active release gate. A new single-site Pagecraft Theme matrix will be added with native package import, page ownership, menus, media, editor, fallback rendering, and uninstall-retention coverage under Issue #11.
