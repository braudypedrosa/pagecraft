"""Run hash-bound import and reimport in the backed-up local QA clone."""
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[2]
candidate = sys.argv[1]
if candidate not in ['electrician-service', 'residential-cleaning', 'landscaping-studio', 'salon-studio', 'bookkeeping-practice']:
    raise SystemExit('Unknown candidate')
draft = root / 'premade-sites' / candidate / '1.0.0' / 'draft'
manifest = json.loads((draft / 'manifest.json').read_text())
command = [
    '/Users/braudypedorsa/Library/Application Support/Local/lightning-services/php-8.1.29+0/bin/darwin-arm64/bin/php',
    '-c', '/Users/braudypedorsa/Library/Application Support/Local/run/c-zu6_zfI/conf/php/php.ini',
    '/Applications/Local.app/Contents/Resources/extraResources/bin/wp-cli/wp-cli.phar',
    '--path=/Users/braudypedorsa/Local Sites/pagecraft-template-acceptance-2026-10-08/app/public',
    'eval-file', str(root / 'qa-evidence/industry-templates-2026-10-13/import-wordpress.php'),
    str(draft / 'site.pagecraft-site.zip'), manifest['packageSha256'],
]
for label in ['import', 'reimport']:
    run = subprocess.run(command, capture_output=True, text=True)
    if run.returncode:
        print(run.stderr)
        raise SystemExit(run.returncode)
    result = json.loads(run.stdout)
    (pathlib.Path(__file__).parent / f'{candidate}-wordpress-{label}.json').write_text(json.dumps(result, indent=2))
    print(candidate, label, json.dumps(result['result']))
    if label == 'reimport' and (result['result']['created'] or result['result']['absent']):
        raise SystemExit('Reimport changed page identities')
