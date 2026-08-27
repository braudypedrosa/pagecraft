#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if ! command -v php >/dev/null 2>&1; then
	echo 'PHP is required for syntax checks.' >&2
	exit 1
fi

while IFS= read -r -d '' file; do
	php -l "${file}" >/dev/null
done < <(find \
	"${WORDPRESS_DIR}/pagecraft-theme" \
	"${WORDPRESS_DIR}/pagecraft-builder" \
	"${WORDPRESS_DIR}/tests" \
	-type f -name '*.php' -print0)

php -r '
$path = $argv[1];
json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
echo "theme.json is valid\n";
' "${WORDPRESS_DIR}/pagecraft-theme/theme.json"

php "${WORDPRESS_DIR}/tests/builder-contract.php"

IMPORT_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-native-import.XXXXXX")"
trap 'rm -rf -- "${IMPORT_TEMP}"' EXIT
node --experimental-strip-types \
	"${WORDPRESS_DIR}/tests/create-page-package-fixture.ts" \
	"${IMPORT_TEMP}/fixture.pagecraft-page.zip"
php "${WORDPRESS_DIR}/tests/native-page-import.php" \
	"${IMPORT_TEMP}/fixture.pagecraft-page.zip"
php "${WORDPRESS_DIR}/tests/global-elements.php" \
	"${IMPORT_TEMP}/fixture.pagecraft-page.zip"
php "${WORDPRESS_DIR}/tests/cloud-import.php" \
	"${IMPORT_TEMP}/fixture.pagecraft-page.zip"
php "${WORDPRESS_DIR}/tests/native-menus.php"
php "${WORDPRESS_DIR}/tests/theme-managed-fallback.php"

echo 'Theme, Builder, and WordPress test PHP syntax is valid.'
