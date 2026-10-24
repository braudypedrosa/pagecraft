#!/usr/bin/env python3
"""Additive audit of actual candidate hover and reload DOM evidence."""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parent
checks=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def check(name,ok):checks.append({'check':name,'passed':bool(ok)});assert ok,name
hover=json.loads((P/'candidate-native-hover.json').read_text());reload=json.loads((P/'candidate-reload-dom.json').read_text())
h={n['text']:n for n in hover['result']};r={n['text']:n for n in reload['result']}
s='QA clipboard class source';t='QA clipboard target'
check('Actual hover and reload evidence use same candidate tab',hover['tabId']==reload['tabId']=='87')
check('Both captures retain exact distinct source and target labels',set(h)==set(r)=={s,t})
check('Target is natively hovered and focused',h[t]['hover'] is True and h[t]['focus'] is True)
check('Actual target Hover background is the copied green',h[t]['bg']=='rgb(49, 81, 61)')
check('Actual target Hover radius is24px',h[t]['radius']=='24px')
check('Source is not hovered or focused and keeps resting Ink18px',h[s]['hover'] is False and h[s]['focus'] is False and h[s]['bg']=='rgb(36, 44, 39)' and h[s]['radius']=='18px')
check('Reloaded source DOM keeps resting Ink18px',r[s]['bg']=='rgb(36, 44, 39)' and r[s]['radius']=='18px')
check('Reloaded target DOM keeps resting Ink18px',r[t]['bg']=='rgb(36, 44, 39)' and r[t]['radius']=='18px')
image=P/'candidate-native-hover.jpg';check('Actual independently viewed hover screenshot is a JPEG',image.read_bytes()[:2]==b'\xff\xd8')
verdict={'status':'ADDITIONAL_NATIVE_HOVER_AND_RELOAD_DOM_ACCEPTED','assertionsPassed':len(checks),'checks':checks,'inputs':{n:sha((P/n).read_bytes()) for n in ['candidate-native-hover.json','candidate-reload-dom.json','candidate-native-hover.jpg']},'screenshotManuallyViewedByIndependentAuditor':True,'limits':['Target was both Hover and Focus during capture; fixture has no Focus override. This does not test competing Hover/Focus precedence.','Reload evidence verifies the two rendered resting values only; no new whole-project persisted export was supplied.','Screenshot shows an image-loading warning. This bounded style audit does not accept image-loading health.','Prior20-assertion audit files are unchanged.','No mobile, WordPress or deployment acceptance is claimed.']}
(P/'candidate-hover-reload-verdict.json').write_text(json.dumps(verdict,indent=2)+'\n')
print(json.dumps({'status':verdict['status'],'assertionsPassed':len(checks),'verdictSHA256':sha((P/'candidate-hover-reload-verdict.json').read_bytes())}))
