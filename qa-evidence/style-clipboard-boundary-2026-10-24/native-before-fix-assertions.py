#!/usr/bin/env python3
"""Validate captured native evidence, including the expected before-fix failure.
Exit 0 means the evidence audit reproduced its named failure, not feature acceptance.
"""
from pathlib import Path
import copy, hashlib, json, struct
P=Path(__file__).resolve().parent
EXPECTED_BASELINE='0826a13f998d879b0fe66028f1b2e9fd7f5855e3cdf91c47c8bdd5fe98acd9b7'
SOURCE='n8l7221q'; TARGET='n8o3cw5x5'; CLASS='qa-clipboard-delete'
checks=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def record(name,ok):
 checks.append({'check':name,'passed':bool(ok)})
 assert ok,name
def load(name):return json.loads((P/(name+'.json')).read_text())
def nodes(x):
 if isinstance(x,dict):
  if x.get('id') and x.get('type') and 'css' in x:yield x
  for v in x.values():yield from nodes(v)
 elif isinstance(x,list):
  for v in x:yield from nodes(v)
def get(d,id):return next(n for n in nodes(d) if n['id']==id)
def remove_target(d,old):
 normalized=copy.deepcopy(d);n=get(normalized,TARGET);n.clear();n.update(copy.deepcopy(old));return normalized
def jpeg_size(data):
 assert data[:2]==b'\xff\xd8'
 i=2
 while i<len(data):
  assert data[i]==255;i+=1
  while data[i]==255:i+=1
  marker=data[i];i+=1
  if marker in (0xd8,0xd9):continue
  length=struct.unpack('>H',data[i:i+2])[0]
  if marker in (0xc0,0xc1,0xc2):return struct.unpack('>HH',data[i+3:i+7])[::-1]
  i+=length
 raise ValueError('JPEG has no frame')
files=['baseline-project','before-class-delete','after-class-delete','after-deleted-class-paste','undo-deleted-class-paste','redo-deleted-class-paste','persisted-deleted-class-paste','restored-project']
docs={n:load(n) for n in files}
before=docs['before-class-delete'];deleted=docs['after-class-delete'];pasted=docs['after-deleted-class-paste']
src_before=get(before,SOURCE);src_deleted=get(deleted,SOURCE);target_before=get(deleted,TARGET);target_after=get(pasted,TARGET)
klass=next(c for c in before['meta']['tokens']['classes'] if c['id']==CLASS)
record('Baseline raw SHA matches accepted original',sha((P/'baseline-project.json').read_bytes())==EXPECTED_BASELINE)
record('Restored raw SHA matches accepted original',sha((P/'restored-project.json').read_bytes())==EXPECTED_BASELINE)
record('Baseline and restored projects have nine pages',len(docs['baseline-project']['pages'])==len(docs['restored-project']['pages'])==9)
record('Source held class and local margin before deletion',src_before['cls']==[CLASS] and src_before['css']=={'d':{'margin-top':'7px'},'t':{},'m':{}})
record('Class contained Ink background and 18px resting radius',klass['css']['d']['background-color']=='var(--c-ink)' and klass['css']['d']['border-radius']=='18px')
record('Class contained green hover and 24px radius',klass['st']['hover']['d']=={'background-color':'#31513d','border-radius':'24px'})
record('Deletion baked resting class appearance into existing source',src_deleted['css']['d']['background-color']=='var(--c-ink)' and src_deleted['css']['d']['border-radius']=='18px')
record('Deletion baked hover into existing source',src_deleted['st']['hover']['d']==klass['st']['hover']['d'])
record('Deletion removed class ID from source and class catalogue',src_deleted['cls']==[] and not any(c['id']==CLASS for c in deleted['meta']['tokens']['classes']))
normalized=copy.deepcopy(deleted);n=get(normalized,SOURCE);n.clear();n.update(copy.deepcopy(src_before));normalized['meta']['tokens']['classes']=copy.deepcopy(before['meta']['tokens']['classes'])
record('Class deletion changed only its catalogue entry and actual source appearance',normalized==before)
record('Paste changed no non-target node or metadata',remove_target(pasted,target_before)==deleted)
record('Paste retained target identity content properties and structure',{k:v for k,v in target_after.items() if k not in ('css','st','cls')}=={k:v for k,v in target_before.items() if k not in ('css','st','cls')})
record('Paste removed orphan class ID',target_after['cls']==[])
record('Paste copied direct local margin',target_after['css']=={'d':{'margin-top':'7px'},'t':{},'m':{}})
record('Paste lost class resting background and radius','background-color' not in target_after['css']['d'] and 'border-radius' not in target_after['css']['d'])
record('Paste lost class hover styling',not target_after.get('st'))
record('One Undo raw project exact after-class-delete',(P/'undo-deleted-class-paste.json').read_bytes()==(P/'after-class-delete.json').read_bytes())
record('One Redo raw project exact after-paste',(P/'redo-deleted-class-paste.json').read_bytes()==(P/'after-deleted-class-paste.json').read_bytes())
record('Persisted native export whole project semantically exact after-paste',docs['persisted-deleted-class-paste']==pasted)
dom={n['id']:n for n in load('after-paste-dom')}
record('Actual resting source DOM retained Ink and18px',dom[SOURCE]['bg']=='rgb(36, 44, 39)' and dom[SOURCE]['radius']=='18px')
record('Actual resting pasted target DOM fell to gray and0px',dom[TARGET]['bg']=='rgb(239, 239, 239)' and dom[TARGET]['radius']=='0px')
record('Actual target DOM retained copied7px margin',dom[TARGET]['margin']=='7px 0px 0px')
image=P/'after-deleted-class-paste.jpg';size=jpeg_size(image.read_bytes())
record('Actual captured screenshot is a valid full viewport JPEG',size==(1689,1314))
verdict={'auditStatus':'REPRODUCED_BEFORE_FIX_FAILURE','featureStatus':'FAIL','evidenceAssertions':{'passed':len(checks),'failed':0},'checks':checks,'featureExpectations':[{'expectation':'Deleted class IDs do not become orphan references','passed':True},{'expectation':'One Undo, Redo and save/reload preserve the exact intended project boundary','passed':True},{'expectation':'Paste styles retains the copied class resting appearance after class deletion','passed':False,'expected':{'background':'Ink (#242c27)','radius':'18px'},'actual':{'background':dom[TARGET]['bg'],'radius':dom[TARGET]['radius']}},{'expectation':'Paste styles retains the copied class hover appearance after class deletion','passed':False,'expected':{'background':'#31513d','radius':'24px'},'actual':'Target has no authored hover state; no native hover screenshot was supplied.'}],'persistedRawBytesMatch':(P/'persisted-deleted-class-paste.json').read_bytes()==(P/'after-deleted-class-paste.json').read_bytes(),'inputs':{n+'.json':sha((P/(n+'.json')).read_bytes()) for n in files+['after-paste-dom']},'screenshot':{'file':image.name,'sha256':sha(image.read_bytes()),'width':size[0],'height':size[1],'manuallyViewedByAuditor':True,'visibleEvidence':'Dark rounded source, pale flat pasted target and Styles pasted success message.'},'limits':['Cloud native desktop before-fix evidence only.','Hover loss is established from authored native exports, not a captured hover interaction.','No mobile, WordPress or candidate-fix acceptance is claimed.','This audit did not operate a browser, author project data, change source code or perform deployment.']}
(P/'native-before-fix-verdict.json').write_text(json.dumps(verdict,indent=2)+'\n')
print(json.dumps({'auditStatus':verdict['auditStatus'],'featureStatus':'FAIL','evidenceAssertions':len(checks),'verdictSHA256':sha((P/'native-before-fix-verdict.json').read_bytes())}))
