#!/usr/bin/env bash
set -euo pipefail

CANDIDATE="/Users/braudypedorsa/Braudy/Projects/Pagecraft/.codex-worktrees/image-link-name-3b75640"
MAIN="${1:-/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft}"
EVIDENCE="qa-evidence/image-link-name-2026-10-23"
MANIFEST="$CANDIDATE/$EVIDENCE/root-integration-manifest.json"
EXPECTED_HEAD="3b7564005f26c0bcfc619a2881d395d80baa5847"

SOURCE=(
  app/src/core/index.ts
  tests/image-link-accessibility.test.tsx
)
GENERATED_INDEX_ONLY=(
  index.html
  dist/core.cjs
  packages/editor/dist/contract.json
  packages/editor/dist/editor.html
  packages/editor/dist/runtime.js
  packages/editor/dist/templates.json
  packages/editor/dist/fixtures/page.pagecraft-page.zip
  packages/editor/dist/fixtures/site.pagecraft-site.zip
)
PROTECTED_WORKING=(
  app/src/core/public-form-controls.generated.ts
  index.html
  dist/core.cjs
  packages/editor/dist/contract.json
  packages/editor/dist/editor.html
  packages/editor/dist/runtime.js
  packages/editor/dist/templates.json
  packages/editor/dist/fixtures/page.pagecraft-page.zip
  packages/editor/dist/fixtures/site.pagecraft-site.zip
  packages/editor/dist/compiler.js
  packages/editor/dist/compiler-worker.js
)

[[ "$(git -C "$MAIN" rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "Main HEAD is not $EXPECTED_HEAD" >&2; exit 1;
}
[[ "$(git -C "$CANDIDATE" rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "Candidate base changed" >&2; exit 1;
}
(cd "$CANDIDATE" && sha256sum -c "$EVIDENCE/freeze-id-family-12.sha256")

python3 - "$CANDIDATE" "$MANIFEST" <<'PY'
from pathlib import Path
import hashlib, json, sys
root=Path(sys.argv[1]); data=json.load(open(sys.argv[2]))
for group in ('source2','generated8IndexOnly','evidence'):
    for rel, expected in data[group].items():
        got=hashlib.sha256((root/rel).read_bytes()).hexdigest()
        if got != expected: raise SystemExit(f'{group} hash mismatch: {rel}')
print('candidate manifest hashes: OK')
PY

for path in "${SOURCE[@]}"; do
  git -C "$MAIN" diff --quiet -- "$path" || { echo "Main source has unstaged changes: $path" >&2; exit 1; }
  git -C "$MAIN" diff --cached --quiet -- "$path" || { echo "Main source has staged changes: $path" >&2; exit 1; }
done
for path in "${GENERATED_INDEX_ONLY[@]}"; do
  git -C "$MAIN" diff --cached --quiet -- "$path" || { echo "Main generated path already staged: $path" >&2; exit 1; }
done

if [[ "${APPLY:-0}" != "1" ]]; then
  echo "Review preflight passed. No files changed. Run with APPLY=1 to integrate."
  echo "Generated outputs will be staged in the Git index only; protected working bytes remain untouched."
  exit 0
fi

before="$(mktemp -t pagecraft-image117-protected-before.XXXXXX)"
after="$(mktemp -t pagecraft-image117-protected-after.XXXXXX)"
trap 'rm -f "$before" "$after"' EXIT
snapshot_protected() {
  local output="$1" path
  : > "$output"
  for path in "${PROTECTED_WORKING[@]}"; do
    if [[ -f "$MAIN/$path" ]]; then sha256sum "$MAIN/$path" >> "$output"
    else printf 'MISSING  %s\n' "$MAIN/$path" >> "$output"
    fi
  done
}
snapshot_protected "$before"

copy_file() {
  mkdir -p "$(dirname "$2")"
  cp "$1" "$2"
  chmod 0644 "$2"
}

for path in "${SOURCE[@]}"; do
  copy_file "$CANDIDATE/$path" "$MAIN/$path"
  git -C "$MAIN" add -- "$path"
done

# Stage reviewed generated blobs without replacing Main's protected working files.
for path in "${GENERATED_INDEX_ONLY[@]}"; do
  blob="$(git -C "$MAIN" hash-object -w -- "$CANDIDATE/$path")"
  mode="$(git -C "$MAIN" ls-files -s -- "$path" | awk 'NR==1{print $1}')"
  [[ -n "$mode" ]] || mode=100644
  git -C "$MAIN" update-index --add --cacheinfo "$mode,$blob,$path"
done

while IFS= read -r path; do
  copy_file "$CANDIDATE/$path" "$MAIN/$path"
  git -C "$MAIN" add -- "$path"
done < <(python3 - "$MANIFEST" <<'PY'
import json,sys
for path in json.load(open(sys.argv[1]))['evidence']: print(path)
PY
)
for name in root-integration-manifest.json root-integrate.sh; do
  copy_file "$CANDIDATE/$EVIDENCE/$name" "$MAIN/$EVIDENCE/$name"
  git -C "$MAIN" add -- "$EVIDENCE/$name"
done

snapshot_protected "$after"
cmp "$before" "$after"
python3 - "$MAIN" "$MANIFEST" <<'PY'
from pathlib import Path
import hashlib, json, subprocess, sys
root=Path(sys.argv[1]); data=json.load(open(sys.argv[2]))
for group in ('source2','generated8IndexOnly','evidence'):
    for rel, expected in data[group].items():
        staged=subprocess.check_output(['git','-C',str(root),'show',':'+rel])
        got=hashlib.sha256(staged).hexdigest()
        if got != expected: raise SystemExit(f'staged {group} mismatch: {rel}')
print('staged manifest hashes: OK')
PY

echo "Image117 integrated into the index. Main protected11 working bytes are exact."
echo "No build, test, commit or push was run in Main."
