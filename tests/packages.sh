#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PACKAGE_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-package-test.XXXXXX")"
trap 'rm -rf -- "${PACKAGE_TEMP}"' EXIT

ROOT_PUBLIC_KEY='ERERERERERERERERERERERERERERERERERERERERERE'

if PAGECRAFT_PACKAGE_OUTPUT_DIR="${PACKAGE_TEMP}" \
	bash "${WORDPRESS_DIR}/tools/build-packages.sh" 0.1.0 >/dev/null 2>&1; then
	echo 'Package build unexpectedly accepted a missing root public key.' >&2
	exit 1
fi

PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL="${ROOT_PUBLIC_KEY}" \
	PAGECRAFT_PACKAGE_OUTPUT_DIR="${PACKAGE_TEMP}" \
	bash "${WORDPRESS_DIR}/tools/build-packages.sh" 0.1.0 >/dev/null

connector="${PACKAGE_TEMP}/pagecraft-connector-0.1.0.zip"
theme="${PACKAGE_TEMP}/pagecraft-theme-0.1.0.zip"
first_connector="$(shasum -a 256 "${connector}" | awk '{print $1}')"
first_theme="$(shasum -a 256 "${theme}" | awk '{print $1}')"

PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL="${ROOT_PUBLIC_KEY}" \
	PAGECRAFT_PACKAGE_OUTPUT_DIR="${PACKAGE_TEMP}" \
	bash "${WORDPRESS_DIR}/tools/build-packages.sh" 0.1.0 >/dev/null

[[ "${first_connector}" == "$(shasum -a 256 "${connector}" | awk '{print $1}')" ]]
[[ "${first_theme}" == "$(shasum -a 256 "${theme}" | awk '{print $1}')" ]]

unzip -tq "${connector}" >/dev/null
unzip -tq "${theme}" >/dev/null
connector_entries="${PACKAGE_TEMP}/connector-entries.txt"
theme_entries="${PACKAGE_TEMP}/theme-entries.txt"
root_trust_source="${PACKAGE_TEMP}/RootTrust.php"
unzip -Z1 "${connector}" >"${connector_entries}"
unzip -Z1 "${theme}" >"${theme_entries}"
unzip -p "${connector}" pagecraft-connector/includes/RootTrust.php >"${root_trust_source}"
grep -Fxq 'pagecraft-connector/pagecraft-connector.php' "${connector_entries}"
grep -Fxq 'pagecraft/style.css' "${theme_entries}"
if grep -Eq '^pagecraft-theme/' "${theme_entries}"; then
	echo 'Pagecraft theme package uses an updater-incompatible stylesheet root.' >&2
	exit 1
fi
if grep -Eq 'pagecraft-connector/(vendor|tests|tools|\.phpunit\.cache)/' "${connector_entries}"; then
	echo 'Connector release package contains test-only dependencies.' >&2
	exit 1
fi
if grep -q '@@PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL@@' "${root_trust_source}"; then
	echo 'Connector release package contains the unprovisioned root marker.' >&2
	exit 1
fi

echo 'Signed-channel WordPress package inputs are deterministic and production-shaped.'
