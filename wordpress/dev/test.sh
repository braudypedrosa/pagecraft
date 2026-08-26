#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/../tests/lint.sh"
bash "${SCRIPT_DIR}/../tests/php81-lint.sh"
bash "${SCRIPT_DIR}/../tests/packages.sh"
bash "${SCRIPT_DIR}/../tests/smoke.sh"
