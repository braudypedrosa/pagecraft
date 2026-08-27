#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORDPRESS_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
VERSION="${1:-0.2.0}"
OUTPUT_DIR="${2:-${WORDPRESS_DIR}/build/release-candidate-${VERSION}}"

mkdir -p "${OUTPUT_DIR}"
PAGECRAFT_PACKAGE_OUTPUT_DIR="${OUTPUT_DIR}" bash "${SCRIPT_DIR}/build-packages.sh" "${VERSION}" >/dev/null
cp "${WORDPRESS_DIR}/RELEASE-NOTES-${VERSION}.md" "${OUTPUT_DIR}/RELEASE-NOTES.md"

cat >"${OUTPUT_DIR}/release-manifest.json" <<JSON
{
  "format": "pagecraft.wordpress-release-candidate.v1",
  "version": "${VERSION}",
  "artifacts": ["pagecraft-builder-${VERSION}.zip", "pagecraft-theme-${VERSION}.zip"],
  "compatibility": {"wordpress": ">=6.6", "php": ">=8.1", "multisite": false},
  "ownership": "WordPress owns every imported copy; no background synchronization.",
  "knownBoundaries": ["Pagecraft Theme only", "single-site only", "cloud CMS bindings rejected", "manual cloud import only"]
}
JSON

(
  cd "${OUTPUT_DIR}"
  LC_ALL=C shasum -a 256 \
    "pagecraft-builder-${VERSION}.zip" "pagecraft-theme-${VERSION}.zip" \
    RELEASE-NOTES.md release-manifest.json >SHA256SUMS
  shasum -a 256 -c SHA256SUMS >/dev/null
)

printf 'Release candidate written to %s\n' "${OUTPUT_DIR}"
