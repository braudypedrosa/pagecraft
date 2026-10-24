#!/usr/bin/env python3
"""Independent offline acceptance of the supplied bounded native fixed-candidate flow."""
from pathlib import Path
import copy, hashlib, json
P=Path(__file__).resolve().parent
SOURCE='n8l7221q';TARGET='n8o3cw5x5';CLASS='qa-clipboard-delete'
checks=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def load(n):return json.loads((P/(n+'.json')).read_text())
def nodes(x):
 if isinstance(x,dict):
  if x.get('id') and x.get('type') and 'css' in x:yield x
  for v in x.values():yield from nodes(v)
 elif isinstance(x,list):
  for v in x:yield from nodes(v)
def node(d,id):return next(n for n in nodes(d) if n['id']==id)
def check(name,result):
 checks.append({'check':name,'passed':bool(result)});assert result,name
before=load('before-class-delete');old_deleted=load('after-class-delete')
paste=load('candidate-fixed-paste');undo=load('candidate-fixed-undo');redo=load('candidate-fixed-redo')
src=node(paste,SOURCE);target=node(paste,TARGET);target_before=node(undo,TARGET)
check('Imported copy source uses the named class',node(before,SOURCE)['cls']==[CLASS])
check('One native Undo is semantically exact original after-class-delete project',undo==old_deleted)
check('One native Redo is semantically exact fixed pasted project',redo==paste)
check('Target retains exact ID content props visibility advanced fields and children',{k:v for k,v in target.items() if k not in ['css','st','cls']}=={k:v for k,v in target_before.items() if k not in ['css','st','cls']})
normalized=copy.deepcopy(paste);n=node(normalized,TARGET);n.clear();n.update(copy.deepcopy(target_before))
check('Paste changes only target styling across whole project',normalized==undo)
check('Source remains exactly its native post-deletion node',src==node(undo,SOURCE))
check('Catalogue and every metadata field remain exact',paste['meta']==undo['meta'])
check('Deleted class is absent from catalogue',not any(c['id']==CLASS for c in paste['meta']['tokens']['classes']))
check('Target and source have no orphan class IDs',target['cls']==src['cls']==[])
check('Every breakpoint of target CSS matches preserved source',target['css']==src['css'])
check('Target copied Ink resting background and18px radius',target['css']['d']['background-color']=='var(--c-ink)' and target['css']['d']['border-radius']=='18px')
check('Target copied direct7px margin',target['css']['d']['margin-top']=='7px')
check('Target copied entire authored source interaction state',target['st']==src['st'])
check('Target includes green Hover and24px radius',target['st']['hover']['d']=={'background-color':'#31513d','border-radius':'24px'})
check('All node identity lists remain unchanged',[n['id'] for n in nodes(paste)]==[n['id'] for n in nodes(undo)])
dom={n['id']:n for n in load('candidate-fixed-dom')}
check('Native DOM source and target both have Ink background',dom[SOURCE]['bg']==dom[TARGET]['bg']=='rgb(36, 44, 39)')
check('Native DOM source and target both have18px radius',dom[SOURCE]['radius']==dom[TARGET]['radius']=='18px')
check('Native DOM source and target both have7px top margin',dom[SOURCE]['margin']==dom[TARGET]['margin']=='7px 0px 0px')
check('Native DOM source and target retain distinct labels',dom[SOURCE]['text']=='QA clipboard class source' and dom[TARGET]['text']=='QA clipboard target')
image=P/'candidate-fixed-native.jpg'
check('Viewed actual candidate screenshot is a JPEG',image.read_bytes()[:2]==b'\xff\xd8')
verdict={'status':'BOUNDED_NATIVE_CANDIDATE_ACCEPTED','assertionsPassed':len(checks),'checks':checks,'nativeScope':'One copied class deleted before one button paste, Cloud-shaped standalone candidate desktop editor.','undoRawBytesExactOldDeletion':(P/'candidate-fixed-undo.json').read_bytes()==(P/'after-class-delete.json').read_bytes(),'redoRawBytesExactPaste':(P/'candidate-fixed-redo.json').read_bytes()==(P/'candidate-fixed-paste.json').read_bytes(),'inputs':{n+'.json':sha((P/(n+'.json')).read_bytes()) for n in ['before-class-delete','after-class-delete','candidate-fixed-paste','candidate-fixed-undo','candidate-fixed-redo','candidate-fixed-dom']},'screenshot':{'file':image.name,'sha256':sha(image.read_bytes()),'manuallyViewedByIndependentAuditor':True,'observed':'Source and selected target both dark and rounded. Styles copied, Class deleted looks kept, and Styles pasted feedback visible.'},'limits':['Native hovered rendering was not supplied; Hover acceptance here is authored-state equality only.','No save/reload, mobile, WordPress, multi-target or surviving-class mutation acceptance is established by these files.','No deployment or production acceptance is claimed.','Independent auditor performed no browser actions or source modifications.']}
(P/'candidate-fixed-verdict.json').write_text(json.dumps(verdict,indent=2)+'\n')
print(json.dumps({'status':verdict['status'],'assertionsPassed':len(checks),'undoRawBytesExactOldDeletion':verdict['undoRawBytesExactOldDeletion'],'redoRawBytesExactPaste':verdict['redoRawBytesExactPaste'],'verdictSHA256':sha((P/'candidate-fixed-verdict.json').read_bytes())}))
