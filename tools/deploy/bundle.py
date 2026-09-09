"""Build a deployable source bundle without secrets, QA dumps or draft templates."""
import hashlib,json,pathlib,subprocess,sys,tarfile,tempfile
root=pathlib.Path(__file__).resolve().parents[2]
sha,branch,output=sys.argv[1:]
assert branch in ('production','development')
assert sha==subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
# Only tracked source files can enter a release. Never traverse ignored env/QA files.
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
prefixes=('app/','server/','shared/','public/','brand/','packages/editor/')
files=[root/name for name in tracked if name.startswith(prefixes) and '/tests/' not in name]
files += [root/name for name in ('app.cjs','index.html','package.json','package-lock.json')]
catalog=json.loads((root/'premade-sites/catalog.json').read_text())
files.append(root/'premade-sites/catalog.json')
for entry in catalog['templates']:
 p=root/'premade-sites'/entry['id']/entry['version']/entry['packageFile']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['packageSha256'],str(p)
 files.append(p)
with tarfile.open(output,'w:gz') as t:
 for p in sorted(set(files)):
  assert not p.is_symlink(),str(p)
  t.add(p,arcname=str(p.relative_to(root)),recursive=False)
 with tempfile.NamedTemporaryFile(mode='w+') as meta:
  json.dump({'commit':sha,'branch':branch},meta);meta.flush();t.add(meta.name,arcname='deployment.json')
print(output)
