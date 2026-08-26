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
	"${WORDPRESS_DIR}/pagecraft-connector" \
	"${WORDPRESS_DIR}/tests" \
	-type f -name '*.php' -print0)

php -r '
$path = $argv[1];
json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
echo "theme.json is valid\n";
' "${WORDPRESS_DIR}/pagecraft-theme/theme.json"

echo 'Theme, connector, and fixture PHP syntax is valid.'
