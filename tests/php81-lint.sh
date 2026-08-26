#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
	echo 'Docker is required for the PHP 8.1 compatibility check.' >&2
	exit 1
fi

docker run --rm \
	--entrypoint sh \
	--volume "${WORDPRESS_DIR}:/workspace:ro" \
	wordpress:6.6-php8.1-apache \
	-lc 'find /workspace/pagecraft-theme /workspace/pagecraft-connector /workspace/tests -type f -name "*.php" -exec php -l {} \; >/dev/null'

echo 'Theme, connector, and fixtures parse on the required PHP 8.1 runtime.'
