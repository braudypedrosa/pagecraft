# Pagecraft WordPress local harness

This harness creates two isolated local WordPress 6.6 / PHP 8.1 installations:

- **Staging** at `http://localhost:8088` activates the universal Pagecraft theme.
- **Production** at `http://localhost:8089` keeps WordPress's bundled Twenty Twenty-Four theme to exercise connector compatibility with an existing theme.

The names describe release roles only. Both installations are local Docker containers and cannot deploy to Pagecraft production.

## Requirements

- Docker with Docker Compose
- `curl`
- PHP 8.1 or later with the DOM extension for local fixture and HTML assertions
- Local source directories at `wordpress/pagecraft-theme` and `wordpress/pagecraft-connector`

## Start and provision

From the repository root:

```bash
cp wordpress/dev/.env.example wordpress/dev/.env
docker compose --file wordpress/dev/compose.yml config
bash wordpress/dev/bootstrap.sh
```

The default local administrator is `pagecraft` / `pagecraft-dev`. Change it in `wordpress/dev/.env` before bootstrap if desired. These credentials are for disposable local containers only.

Bootstrap is idempotent. It:

1. Starts independent MariaDB and WordPress services.
2. Installs both sites and enables pretty permalinks.
3. Activates Pagecraft theme on staging and Twenty Twenty-Four on production.
4. Creates native WordPress-owned pages and a post in both sites.
5. Activates Pagecraft Connector when its source is present.
6. Verifies and stages the shared signed Connected release, then maps and atomically activates it through the connector when enabled.
7. Runs the smoke suite against both HTTP surfaces.

Set `PAGECRAFT_INSTALL_RELEASE_FIXTURE=0` to exercise only native fallbacks.
Set `PAGECRAFT_ACTIVATE_CONNECTOR=0` to run the theme-only track while the connector is unavailable or under development.
Set `PAGECRAFT_RUN_SEO_MATRIX=0` to skip the SEO compatibility matrix.

## Run checks again

```bash
bash wordpress/dev/test.sh
```

The smoke suite verifies:

- Pagecraft theme mode preserves native WordPress-owned content.
- Existing-theme mode preserves the selected stock theme and native content.
- Connector APIs exist when the plugin is active.
- The same managed route renders through both theme modes.
- Every supported Pagecraft component's real Core-rendered DOM, ordered approved runtime occurrences, responsive CSS, WordPress-managed form, CMS item, mirrored asset, and frozen YouTube/Vimeo embed contract survives the signed release pipeline.
- Public HTML exposes the exact active deployment marker before the fixture is marked health-verified.
- Pagecraft metadata and body classes appear only on managed routes.
- Neither WordPress debug log contains a PHP fatal error.
- Fallback SEO, Yoast-only, and Rank Math-only preflight states are healthy on both profiles.
- Activating Yoast and Rank Math together produces the blocking `pagecraft_seo_conflict` preflight result.

The matrix pins Yoast SEO 23.5 and Rank Math SEO 1.0.225 because those published releases support WordPress 6.6. Override `YOAST_VERSION` or `RANK_MATH_VERSION` to validate another supported release deliberately.

## Useful commands

```bash
docker compose --file wordpress/dev/compose.yml ps
docker compose --file wordpress/dev/compose.yml logs --tail=100 staging-wordpress
docker compose --file wordpress/dev/compose.yml logs --tail=100 production-wordpress
docker compose --file wordpress/dev/compose.yml run --rm staging-cli plugin list
docker compose --file wordpress/dev/compose.yml run --rm production-cli theme list
```

## Stop or reset

Stop containers while preserving data:

```bash
docker compose --file wordpress/dev/compose.yml down
```

Delete only this harness's local volumes and start clean:

```bash
docker compose --file wordpress/dev/compose.yml down --volumes
```

The reset command permanently removes the two disposable local databases and uploads volumes. It does not modify the repository, remote WordPress sites, or Pagecraft production.

## Fixture boundary

`wordpress/tests/fixtures/install-active-release.php` reads the same immutable vector as the Node and connector tests. It verifies the root-signed keyset, project release signature, canonical artifact hash, typed forms, runtime inventory, and staged assets, then runs target-local preflight, `Mapper`, and `ReleaseRepository` activation on each real WordPress profile. The smoke suite verifies the exact public deployment marker before persisting the health-verification marker.

The vector contains one fixed signed deployment envelope, so Docker does not reuse that envelope for two different origins/profiles. It creates a clearly test-only target binding after verifying the target-neutral signed project release. Exact deployment-envelope origin/path/profile/environment/installation binding, clone rejection, replay protection, acknowledgements, and network pairing remain covered by the connector protocol suite and backend integration tests.

## Build private release packages

Release archives are built from disposable copies. The connector copy receives
the pinned Ed25519 root public key; the source marker is never shipped:

```bash
PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL='<raw-public-key-base64url>' \
  bash wordpress/tools/build-packages.sh 0.1.0
```

The command creates deterministic, top-level plugin/theme ZIPs under
`wordpress/build/`, prints their SHA-256 hashes, excludes test dependencies, and
fails if the requested version differs from either WordPress package header.
