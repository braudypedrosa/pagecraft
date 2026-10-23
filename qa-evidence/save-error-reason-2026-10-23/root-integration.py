import hashlib
import json
import pathlib
import shutil
import subprocess

MAIN = pathlib.Path('/Users/braudypedorsa/Braudy/Projects/Pagecraft/pagecraft')
CANDIDATE = MAIN.parent / '.codex-worktrees/save-recovery-de06424'
BASE = 'de06424b28d74d035809156c604adeb008e069af'
SOURCE = {
    'builder.html': '025b98a4bdb826110713d56f0e3300c9ff12a29812dd689589a915fce1f32df8',
    'tests/editor-save-rejection.test.mjs': '7c3b451a23d2be1358781f3ad54775f97b6a894ce25647e028465f83ad0de7e5',
    'public/internal-ui-baselines/manifest.json': 'c3b3bcb9d1d3fd5a78d9098aea55ba208292f36d9857b6b7c4df0c8e4a126b62',
}

def git(*args, data=None):
    return subprocess.check_output(['git', *args], cwd=MAIN, input=data)

def sha(data):
    return hashlib.sha256(data).hexdigest()

assert git('rev-parse', 'HEAD').decode().strip() == BASE
assert not git('diff', '--cached', '--name-only').strip(), 'Existing staged work must be preserved.'
protected = json.loads((MAIN / 'qa-evidence/list-nowrap-2026-10-22/integration-preservation.json').read_text())['protectedWorkingBytes']
assert len(protected) == 11
for name, expected in protected.items():
    assert sha((MAIN / name).read_bytes()) == expected, name
for name, expected in SOURCE.items():
    assert sha((CANDIDATE / name).read_bytes()) == expected, name
    assert (MAIN / name).read_bytes() == git('show', 'HEAD:' + name), name
old_manifest = json.loads((MAIN / 'public/internal-ui-baselines/manifest.json').read_text())
new_manifest = json.loads((CANDIDATE / 'public/internal-ui-baselines/manifest.json').read_text())
new_manifest['sources']['builder.html'] = old_manifest['sources']['builder.html']
assert old_manifest == new_manifest, 'Only reviewed builder fingerprint may differ.'
evidence = pathlib.Path('qa-evidence/save-recovery-2026-10-23')
receipts = [(CANDIDATE / evidence / f).read_bytes() for f in ['generated-build-1.sha256', 'generated-build-2.sha256', 'generated-current.sha256']]
assert receipts[0] == receipts[1] == receipts[2]
generated = dict((line.split('  ', 1)[1], line.split('  ', 1)[0]) for line in receipts[0].decode().splitlines())
assert len(generated) == 10
for name, expected in generated.items():
    assert sha((CANDIDATE / name).read_bytes()) == expected, name
assert generated['packages/editor/dist/runtime.js'] == '80e22127be29ae0ef53e7430164c65f7bc1cef2a939a46f4917ac9c7344efd09'
for name in generated:
    if name not in ['index.html', 'packages/editor/dist/editor.html', 'packages/editor/dist/compiler.js', 'packages/editor/dist/compiler-worker.js']:
        assert (CANDIDATE / name).read_bytes() == git('show', 'HEAD:' + name), name

for name in SOURCE:
    shutil.copyfile(CANDIDATE / name, MAIN / name)
copied = []
for item in sorted((CANDIDATE / evidence).iterdir()):
    if item.is_file():
        target = MAIN / evidence / item.name
        target.parent.mkdir(parents=True, exist_ok=True)
        assert not target.exists(), str(target)
        shutil.copyfile(item, target)
        copied.append(str(evidence / item.name))
subprocess.run(['git', 'add', '--', *SOURCE, *copied], cwd=MAIN, check=True)
for name in generated:
    if name in ['packages/editor/dist/compiler.js', 'packages/editor/dist/compiler-worker.js']:
        continue
    blob = git('hash-object', '-w', '--stdin', data=(CANDIDATE / name).read_bytes()).decode().strip()
    subprocess.run(['git', 'update-index', '--add', '--cacheinfo', '100644', blob, name], cwd=MAIN, check=True)
for name, expected in protected.items():
    assert sha((MAIN / name).read_bytes()) == expected, name
subprocess.run(['git', 'diff', '--cached', '--check', '--', *SOURCE], cwd=MAIN, check=True)
receipt = {'base': BASE, 'source3': SOURCE, 'generated10': generated, 'generatedWorkingBytesPreserved': 11,
           'galleryReview': 'Only builder source fingerprint changed. Historical PNGs and provenance preserved. No fresh capture claimed.',
           'copiedEvidence': copied, 'stagedPaths': git('diff', '--cached', '--name-only').decode().splitlines()}
destination = MAIN / 'qa-evidence/save-error-reason-2026-10-23/root-integration.json'
destination.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'stagedPaths': receipt['stagedPaths'], 'protectedWorkingBytesPreserved': 11}))
