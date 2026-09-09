#!/usr/bin/python3
"""Forced SSH entrypoint installed outside the app; accepts only release bundles."""
import fcntl,hashlib,json,os,pathlib,re,shlex,shutil,socket,subprocess,sys,tarfile,time,urllib.request
os.umask(0o077)
HOME=pathlib.Path('/home/itspbuku'); CONTROL=HOME/'pagecraft-deploy'
args=shlex.split(os.environ.get('SSH_ORIGINAL_COMMAND',''))
if len(args)!=3 or args[0]!='deploy' or args[1] not in ('production','development') or not re.fullmatch('[0-9a-f]{40}',args[2]):sys.exit('Invalid deployment command')
branch,sha=args[1:]
if os.environ.get('PAGECRAFT_DEPLOY_BRANCH')!=branch:sys.exit('Deployment key cannot deploy this branch')
app='pagecraft-app' if branch=='production' else 'pagecraft-staging'
domain='build.itspagecraft.com' if branch=='production' else 'staging.itspagecraft.com'
lock=open(CONTROL/(app+'.lock'),'w');fcntl.flock(lock,fcntl.LOCK_EX)
release=HOME/'pagecraft-releases'/app/(sha+'-'+str(int(time.time())))
release.mkdir(parents=True)
log=open(CONTROL/(app+'-'+sha+'.log'),'w')
def run(a,**kw):return subprocess.run(a,check=True,stdout=log,stderr=log,**kw)
def restart():
 result=json.loads(subprocess.check_output(['cloudlinux-selector','restart','--json','--interpreter','nodejs','--domain',domain,'--app-root',app]))
 if result.get('result')!='success':raise ValueError('CloudLinux restart failed')
try:
 archive=release/'incoming.tar.gz'
 with archive.open('wb') as f:
  total=0
  while True:
   chunk=sys.stdin.buffer.read(1024*1024)
   if not chunk:break
   total+=len(chunk)
   if total>300*1024*1024:raise ValueError('Bundle too large')
   f.write(chunk)
 with tarfile.open(archive) as t:
  for m in t.getmembers():
   p=pathlib.PurePosixPath(m.name)
   if p.is_absolute() or '..' in p.parts or not m.isfile():raise ValueError('Unsafe bundle member')
  t.extractall(release)
 archive.unlink()
 meta=json.loads((release/'deployment.json').read_text())
 if meta!={'commit':sha,'branch':branch}:raise ValueError('Revision mismatch')
 cfg=json.loads(subprocess.check_output(['cloudlinux-selector','get','--json','--interpreter','nodejs','--user','itspbuku']))
 appcfg=next(v['users']['itspbuku']['applications'][app] for v in cfg['available_versions'].values() if app in v.get('users',{}).get('itspbuku',{}).get('applications',{}))
 env={**os.environ,**appcfg['env_vars']}
 if env.get('EDITOR_HOST')!=domain:raise ValueError('Environment host mismatch')
 if branch=='development' and env.get('SUPABASE_URL')=='https://pwgwvicrdbjiecjxiyvl.supabase.co':
  if env.get('PAGECRAFT_ALLOW_SHARED_DATABASE')!='1':raise ValueError('Shared staging database requires explicit opt-in')
  if env.get('PAGECRAFT_BACKGROUND_WORKERS')!='0':raise ValueError('Shared staging must not drain production queues')
  if env.get('PAGECRAFT_PUBLICATION_ROOT')!='/home/itspbuku/pagecraft-staging-publications':raise ValueError('Staging publications must remain separate')
 node=HOME/'nodevenv'/app/'24/bin/node';npm=HOME/'nodevenv'/app/'24/bin/npm'
 env['PATH']=str(node.parent)+':'+os.environ.get('PATH','/usr/bin:/bin')
 # Production dependencies are installed on the target OS in the new release.
 run([str(npm),'ci','--omit=dev','--no-audit','--no-fund'],cwd=release,env=env)
 env['PAGECRAFT_TEMPLATE_ROOT']=str(release/'premade-sites')
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 env.update(PORT=str(port),BIND_HOST='127.0.0.1',PAGECRAFT_BACKGROUND_WORKERS='0')
 process=subprocess.Popen([str(node),'server/src/index.ts'],cwd=release,env=env,stdout=log,stderr=log)
 try:
  for attempt in range(45):
   if process.poll() is not None:raise ValueError('Candidate startup failed')
   try:
    req=urllib.request.Request('http://127.0.0.1:'+str(port)+'/__deployment',headers={'Host':domain})
    with urllib.request.urlopen(req,timeout=3) as response:
     if json.load(response)==meta:break
   except Exception:time.sleep(1)
  else:raise ValueError('Candidate readiness timed out')
 finally:
  process.terminate();process.wait(timeout=10)
 current=HOME/app/'current'
 previous=current.resolve() if current.is_symlink() else None
 # Released template versions are immutable, including versions omitted accidentally.
 oldroot=(previous/'premade-sites') if previous else HOME/'pagecraft-template-library'
 oldcatalog=oldroot/'catalog.json'
 if oldcatalog.exists():
  old=json.loads(oldcatalog.read_text())['templates']
  new=json.loads((release/'premade-sites/catalog.json').read_text())['templates']
  hashes={(x['id'],x['version']):x['packageSha256'] for x in new}
  for item in old:
   if hashes.get((item['id'],item['version']))!=item['packageSha256']:raise ValueError('Released template changed or removed')
 temporary=HOME/app/'current.next'
 if temporary.is_symlink():temporary.unlink()
 temporary.symlink_to(release)
 try:
  os.replace(temporary,current)
  restart()
  for attempt in range(30):
   try:
    with urllib.request.urlopen('https://'+domain+'/__deployment',timeout=10) as response:
     if json.load(response)==meta:break
   except Exception:time.sleep(2)
  else:raise ValueError('Public deployment verification failed')
 except Exception:
  if temporary.is_symlink():temporary.unlink()
  if previous:
   temporary.symlink_to(previous);os.replace(temporary,current)
  else:
   current.unlink()
  restart();raise
 (CONTROL/(app+'-current.json')).write_text(json.dumps({**meta,'previous':str(previous) if previous else None,'release':str(release)}))
 print(json.dumps({'deployed':domain,**meta}))
except Exception as error:
 print('Deployment failed; inspect protected server deployment log:',type(error).__name__,file=sys.stderr);sys.exit(1)
