"""Copy only compiled previews and native candidate packages for public review."""
import json
import pathlib
import shutil
root = pathlib.Path(__file__).resolve().parents[2]
out = root / '.pagecraft-local/industry-templates-2026-10-13/review-public'
ids = ['electrician-service', 'residential-cleaning', 'landscaping-studio', 'salon-studio', 'bookkeeping-practice']
for candidate in ids:
    source = root / 'premade-sites' / candidate / '1.0.0/draft'
    target = out / candidate
    shutil.copytree(source / 'preview', target, dirs_exist_ok=True)
    shutil.copy2(source / 'site.pagecraft-site.zip', target / 'site.pagecraft-site.zip')
    shutil.copy2(source / 'manifest.json', target / 'manifest.json')
    manifest = json.loads((source / 'manifest.json').read_text())
    (target / 'package.sha256').write_text(manifest['packageSha256'] + '  site.pagecraft-site.zip\n')
    print(candidate, manifest['sampleName'], len(manifest['pages']), manifest['packageSha256'])
