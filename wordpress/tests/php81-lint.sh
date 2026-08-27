#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
	echo 'Docker is required for the PHP 8.1 compatibility check.' >&2
	exit 1
fi

IMPORT_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-php81-import.XXXXXX")"
trap 'rm -rf -- "${IMPORT_TEMP}"' EXIT
node --experimental-strip-types \
	"${WORDPRESS_DIR}/tests/create-page-package-fixture.ts" \
	"${IMPORT_TEMP}/fixture.pagecraft-page.zip"

docker run --rm \
	--entrypoint sh \
	--volume "${WORDPRESS_DIR}:/workspace:ro" \
	--volume "${IMPORT_TEMP}:/fixtures:ro" \
	wordpress:6.6-php8.1-apache \
	-lc 'set -e
		find /workspace/pagecraft-theme /workspace/pagecraft-builder /workspace/tests -type f -name "*.php" -exec php -l {} \; >/dev/null
		php /workspace/tests/builder-contract.php
		php /workspace/tests/native-page-import.php /fixtures/fixture.pagecraft-page.zip
		php /workspace/tests/global-elements.php /fixtures/fixture.pagecraft-page.zip
		php /workspace/tests/native-menus.php
		php /workspace/tests/theme-managed-fallback.php'

echo 'Theme, Builder, and WordPress ownership tests pass on the required PHP 8.1 runtime.'
