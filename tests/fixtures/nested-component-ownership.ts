import * as C from '../../app/src/core/index.ts';
import type { ComponentDef, Node } from '../../app/src/core/types.ts';
export function nestedOwnerFixture() {
 C.seed();C.state.ui=C.initUi();C.blankProject('Nested ownership QA');C.state.meta.components=[];
 const node=(id:string,type='box',children:Node[]=[])=>{const n=C.N(type,{},undefined,children);n.id=id;return n;};
 const leafRoot=node('nleafroot','text');leafRoot.props.html='<p></p>';C.bindSet(leafRoot,'html',{src:'prop',path:'text'});
 const leaf:ComponentDef={id:'leaf',name:'Leaf',node:leafRoot,props:[{k:'text',label:'Text',t:'rich',def:'<p></p>'}]};
 const use=(id:string,def:ComponentDef)=>{const n=node(id,def.node.type);n.use=def.id;return n;};
 const nested=use('nnestedleaf',leaf);C.instSet(nested,'text','<p>Nested value</p>');
 const slot=node('nslot');slot.slot='body';
 const middle:ComponentDef={id:'middle',name:'Middle',node:node('nmiddleroot','box',[nested,slot]),props:[]};
 const first=use('nfirstmiddle',middle),second=use('nsecondmiddle',middle);
 const ownFilled=use('nfilledleaf',leaf);C.instSet(ownFilled,'text','<p>Nested slot value</p>');first.children=[ownFilled];
 const outer:ComponentDef={id:'outer',name:'Outer',node:node('nouterroot','box',[first,second]),props:[]};
 C.components().push(leaf,middle,outer);
 const placement=use('nouterplacement',outer),duplicate=use('nouterduplicate',outer);
 C.state.pages[0].tree=[placement,duplicate];
 return {node,use,leaf,middle,outer,nested,slot,first,second,ownFilled,placement,duplicate};
}
