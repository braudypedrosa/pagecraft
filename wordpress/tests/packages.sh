#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PACKAGE_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/pagecraft-package-test.XXXXXX")"
trap 'rm -rf -- "${PACKAGE_TEMP}"' EXIT

PAGECRAFT_PACKAGE_OUTPUT_DIR="${PACKAGE_TEMP}" \
	bash "${WORDPRESS_DIR}/tools/build-packages.sh" 0.2.0 >/dev/null

builder="${PACKAGE_TEMP}/pagecraft-builder-0.2.0.zip"
theme="${PACKAGE_TEMP}/pagecraft-theme-0.2.0.zip"
first_builder="$(shasum -a 256 "${builder}" | awk '{print $1}')"
first_theme="$(shasum -a 256 "${theme}" | awk '{print $1}')"

PAGECRAFT_PACKAGE_OUTPUT_DIR="${PACKAGE_TEMP}" \
	bash "${WORDPRESS_DIR}/tools/build-packages.sh" 0.2.0 >/dev/null

[[ "${first_builder}" == "$(shasum -a 256 "${builder}" | awk '{print $1}')" ]]
[[ "${first_theme}" == "$(shasum -a 256 "${theme}" | awk '{print $1}')" ]]

unzip -tq "${builder}" >/dev/null
unzip -tq "${theme}" >/dev/null
builder_entries="${PACKAGE_TEMP}/builder-entries.txt"
theme_entries="${PACKAGE_TEMP}/theme-entries.txt"
unzip -Z1 "${builder}" >"${builder_entries}"
unzip -Z1 "${theme}" >"${theme_entries}"
grep -Fxq 'pagecraft-builder/pagecraft-builder.php' "${builder_entries}"
grep -Fxq 'pagecraft-builder/uninstall.php' "${builder_entries}"
grep -Fxq 'pagecraft/style.css' "${theme_entries}"
if grep -Eq '^pagecraft-theme/' "${theme_entries}"; then
	echo 'Pagecraft theme package uses an updater-incompatible stylesheet root.' >&2
	exit 1
fi
if grep -Eq 'pagecraft-builder/(vendor|tests|tools|\.phpunit\.cache)/' "${builder_entries}"; then
	echo 'Builder release package contains test-only dependencies.' >&2
	exit 1
fi
if grep -Eqi 'pagecraft-connector|includes/(Sync|ReleaseRepository|CmsWriteback|Cron)\.php' "${builder_entries}"; then
	echo 'Builder release package contains retired Connected-mode files.' >&2
	exit 1
fi
if unzip -p "${builder}" pagecraft-builder/uninstall.php | grep -Eq 'wp_delete_post|delete_post_meta|wp_delete_attachment'; then
	echo 'Builder uninstall deletes WordPress-owned imported content.' >&2
	exit 1
fi

echo 'Native Pagecraft Builder and Theme package inputs are deterministic and production-shaped.'
