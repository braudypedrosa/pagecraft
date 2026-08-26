# WordPress test tracks

## Static checks

```bash
bash wordpress/tests/lint.sh
```

This validates every PHP file in the universal theme and parses `theme.json`.

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

This proves the connector/theme archives are repeatable, have the required
top-level directory, exclude unit-test dependencies, and cannot ship with the
root trust marker unresolved.

## Docker smoke checks

Provision the local environments first:

```bash
bash wordpress/dev/bootstrap.sh
```

Then rerun HTTP and WordPress-state checks with:

```bash
bash wordpress/tests/smoke.sh
```

The Docker fixture consumes the shared backend golden vector. It verifies the root-signed release trust chain and canonical artifact, stages exact asset bytes, inventories and explicitly approves declared test runtime fingerprints, runs target-local preflight, and activates through `Stager`, `Mapper`, and `ReleaseRepository` on both profiles. HTTP checks cover real Core-rendered component DOM and interaction hooks, ordered runtime occurrences, responsive CSS, frozen YouTube/Vimeo media, CMS mappings, WordPress-managed forms, exact release identity, and native-content isolation.

Because one immutable golden deployment envelope cannot legitimately bind two Docker origins/profiles, the Docker installer creates a test-only local deployment binding after project-release verification. Deployment-envelope clone/origin/path/profile/replay behavior and acknowledgement transport remain in the connector/backend protocol tests.

## SEO compatibility matrix

When Pagecraft Connector is active, `smoke.sh` invokes `seo-matrix.sh`. The matrix installs pinned WordPress-6.6-compatible plugin releases, then tests these states independently on both theme profiles:

1. Pagecraft fallback SEO, with both external SEO plugins inactive.
2. Yoast SEO only.
3. Rank Math SEO only.
4. Yoast and Rank Math together, which must report `pagecraft_seo_conflict` and fail the connector's human-readable preflight doctor.
5. Restored fallback state.

The stable assertion contract is `wp pagecraft doctor --format=json`, specifically `seo.adapter`, `seo.ok`, and `seo.error_code`.
