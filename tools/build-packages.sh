#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
VERSION="${1:-${PAGECRAFT_PACKAGE_VERSION:-0.2.0}}"
OUTPUT_DIR="${PAGECRAFT_PACKAGE_OUTPUT_DIR:-${WORDPRESS_DIR}/build}"

if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
	echo "Invalid semantic package version: ${VERSION}" >&2
	exit 1
fi

for tool in zip unzip shasum; do
	command -v "${tool}" >/dev/null 2>&1 || {
		echo "${tool} is required to build WordPress packages." >&2
		exit 1
	}
done

builder_version="$(sed -n 's/^ \* Version: //p' "${WORDPRESS_DIR}/pagecraft-builder/pagecraft-builder.php" | head -1)"
theme_version="$(sed -n 's/^Version: //p' "${WORDPRESS_DIR}/pagecraft-theme/style.css" | head -1)"
if [[ "${builder_version}" != "${VERSION}" || "${theme_version}" != "${VERSION}" ]]; then
	echo "Package version ${VERSION} must match builder ${builder_version} and theme ${theme_version}." >&2
	exit 1
fi

PACKAGE_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-packages.XXXXXX")"
trap 'rm -rf -- "${PACKAGE_TEMP}"' EXIT

cp -R "${WORDPRESS_DIR}/pagecraft-builder" "${PACKAGE_TEMP}/pagecraft-builder"
cp -R "${WORDPRESS_DIR}/pagecraft-theme" "${PACKAGE_TEMP}/pagecraft"

rm -rf -- \
	"${PACKAGE_TEMP}/pagecraft-builder/vendor" \
	"${PACKAGE_TEMP}/pagecraft-builder/tests" \
	"${PACKAGE_TEMP}/pagecraft-builder/tools" \
	"${PACKAGE_TEMP}/pagecraft-builder/.phpunit.cache" \
	"${PACKAGE_TEMP}/pagecraft-builder/composer.json" \
	"${PACKAGE_TEMP}/pagecraft-builder/composer.lock" \
	"${PACKAGE_TEMP}/pagecraft-builder/phpunit.xml.dist" \
	"${PACKAGE_TEMP}/pagecraft-builder/.gitignore"

find "${PACKAGE_TEMP}/pagecraft-builder" "${PACKAGE_TEMP}/pagecraft" -exec touch -t 198001010000 {} +
mkdir -p "${OUTPUT_DIR}"

for package in pagecraft-builder:pagecraft-builder pagecraft-theme:pagecraft; do
	slug="${package%%:*}"
	root="${package#*:}"
	archive="${OUTPUT_DIR}/${slug}-${VERSION}.zip"
	(
		cd "${PACKAGE_TEMP}"
		find "${root}" -type f -print | LC_ALL=C sort | zip -X -q "${archive}" -@
	)
	printf '%s  %s\n' "$(shasum -a 256 "${archive}" | awk '{print $1}')" "${archive}"
done
