#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
VERSION="${1:-${PAGECRAFT_PACKAGE_VERSION:-0.1.0}}"
OUTPUT_DIR="${PAGECRAFT_PACKAGE_OUTPUT_DIR:-${WORDPRESS_DIR}/build}"
ROOT_PUBLIC_KEY="${PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL:-}"

if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
	echo "Invalid semantic package version: ${VERSION}" >&2
	exit 1
fi

if [[ -z "${ROOT_PUBLIC_KEY}" ]]; then
	echo 'PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL is required.' >&2
	exit 1
fi

node -e '
const value = process.argv[1];
if (!/^[A-Za-z0-9_-]+$/.test(value)) process.exit(1);
const bytes = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
if (bytes.length !== 32) process.exit(1);
' "${ROOT_PUBLIC_KEY}" || {
	echo 'PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL must encode one raw 32-byte Ed25519 public key.' >&2
	exit 1
}

for tool in node zip unzip shasum; do
	command -v "${tool}" >/dev/null 2>&1 || {
		echo "${tool} is required to build WordPress packages." >&2
		exit 1
	}
done

connector_version="$(sed -n 's/^ \* Version: //p' "${WORDPRESS_DIR}/pagecraft-connector/pagecraft-connector.php" | head -1)"
theme_version="$(sed -n 's/^Version: //p' "${WORDPRESS_DIR}/pagecraft-theme/style.css" | head -1)"
if [[ "${connector_version}" != "${VERSION}" || "${theme_version}" != "${VERSION}" ]]; then
	echo "Package version ${VERSION} must match connector ${connector_version} and theme ${theme_version}." >&2
	exit 1
fi

PACKAGE_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-packages.XXXXXX")"
trap 'rm -rf -- "${PACKAGE_TEMP}"' EXIT

cp -R "${WORDPRESS_DIR}/pagecraft-connector" "${PACKAGE_TEMP}/pagecraft-connector"
cp -R "${WORDPRESS_DIR}/pagecraft-theme" "${PACKAGE_TEMP}/pagecraft"

rm -rf -- \
	"${PACKAGE_TEMP}/pagecraft-connector/vendor" \
	"${PACKAGE_TEMP}/pagecraft-connector/tests" \
	"${PACKAGE_TEMP}/pagecraft-connector/tools" \
	"${PACKAGE_TEMP}/pagecraft-connector/.phpunit.cache" \
	"${PACKAGE_TEMP}/pagecraft-connector/composer.json" \
	"${PACKAGE_TEMP}/pagecraft-connector/composer.lock" \
	"${PACKAGE_TEMP}/pagecraft-connector/phpunit.xml.dist" \
	"${PACKAGE_TEMP}/pagecraft-connector/.gitignore"

node -e '
const fs = require("fs");
const path = process.argv[1];
const key = process.argv[2];
const marker = "@@PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL@@";
const source = fs.readFileSync(path, "utf8");
if (!source.includes(marker)) throw new Error("Root trust marker is missing from the source package");
const packaged = source.replaceAll(marker, key);
if (packaged.includes(marker)) throw new Error("Root trust marker remained in the package");
fs.writeFileSync(path, packaged);
' "${PACKAGE_TEMP}/pagecraft-connector/includes/RootTrust.php" "${ROOT_PUBLIC_KEY}"

find "${PACKAGE_TEMP}/pagecraft-connector" "${PACKAGE_TEMP}/pagecraft" -exec touch -t 198001010000 {} +
mkdir -p "${OUTPUT_DIR}"

for package in pagecraft-connector:pagecraft-connector pagecraft-theme:pagecraft; do
	slug="${package%%:*}"
	root="${package#*:}"
	archive="${OUTPUT_DIR}/${slug}-${VERSION}.zip"
	(
		cd "${PACKAGE_TEMP}"
		find "${root}" -type f -print | LC_ALL=C sort | zip -X -q "${archive}" -@
	)
	if [[ "${slug}" == 'pagecraft-connector' ]] && unzip -p "${archive}" 'pagecraft-connector/includes/RootTrust.php' 2>/dev/null | grep -q '@@PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL@@'; then
		echo "Refusing package with an unprovisioned root key: ${archive}" >&2
		exit 1
	fi
	printf '%s  %s\n' "$(shasum -a 256 "${archive}" | awk '{print $1}')" "${archive}"
done
