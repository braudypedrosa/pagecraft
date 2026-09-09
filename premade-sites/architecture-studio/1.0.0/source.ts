import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node, Page, ComponentDef } from '../../../app/src/core/types.ts';
const N = Core.N, C = Core.cvar;
let serial = 0;
const named = (n: Node, name: string) => { n.id = `cg-${name}-${++serial}`; return n; };
const box = (name: string, children: Node[], d: Record<string,string> = {}, m: Record<string,string> = {}) => named(N('box', {layout:'block'}, {d,t:{},m}, children),name);
const heading = (copy: string, level: 'h1'|'h2'|'h3' = 'h2') => named(N('heading',{text:copy,level,ts:level==='h1'?'display':level==='h2'?'title':'subtitle'},{d:{margin:'0'},t:{},m:{}}),'heading');
const text = (html: string, ts='body', d: Record<string,string> = {}) => named(N('text',{html,ts},{d:{margin:'0',...d},t:{},m:{}}),'copy');
const image = (asset: string, alt: string, tall=false) => named(N('image',{src:`asset:${asset}`,alt,w:'1536',h:'1024',lazy:0},{d:{width:'100%',height:tall?'540px':'390px','object-fit':'cover','border-radius':'0',display:'block'},t:{height:'380px'},m:{height:tall?'370px':'290px'}}),asset);
const section = (name: string, children: Node[], d: Record<string,string> = {}) => named(N('section',{}, {d:{padding:'48px 32px',...d},t:{padding:'40px 24px'},m:{padding:'32px 20px'}},children),name);
const grid = (name: string, children: Node[], columns='0.8fr 1.4fr') => box(name,children,{display:'grid','grid-template-columns':columns,gap:'48px','align-items':'start'},{'grid-template-columns':'1fr',gap:'24px'});
const anchor=(n:Node,id:string)=>{n.adv.htmlId=id;return n;};
const link=(copy:string,href:string)=>named(N('button',{text:copy,link:href,ts:'btn',variant:'outline'},{d:{'background-color':'transparent',color:C('ink'),padding:'12px 0','border-width':'0','border-radius':'0','min-height':'44px','text-decoration':'underline','text-underline-offset':'5px','align-self':'start'},t:{},m:{}}),'link');
function bind(n:Node,prop:string,path:string){n.bind={...(n.bind||{}),[prop]:{src:'prop',path}};return n;}
function projectDefinition(): ComponentDef {
  const title=bind(heading('Project title'),'text','title');
  const category=bind(named(N('heading',{text:'Project type',level:'p',ts:'small'},{d:{margin:'0',color:C('muted'),'margin-top':'16px'},t:{},m:{}}),'copy'),'text','category');
  const description=bind(named(N('heading',{text:'Project description',level:'p',ts:'body'},{d:{margin:'0','margin-top':'20px','max-width':'34ch'},t:{},m:{}}),'copy'),'text','description');
  const picture=bind(bind(image('reading-room','Project image'),'src','image'),'alt','alt');
  picture.showIf={bind:{src:'prop',path:'image'},op:'set'};
  const action=bind(bind(link('Explore the project','contact.html'),'link','link'),'text','action');
  const root=grid('project-record',[box('project-facts',[title,category,description,action]),picture]);
  return {id:'project-record',name:'Project record',node:root,props:[
    {k:'title',label:'Project title',t:'text',def:'Workshop reading room'},
    {k:'category',label:'Project type',t:'text',def:'Adaptive reuse'},
    {k:'description',label:'Project description',t:'text',def:'Retain the shell. Open the garden edge. Make one shared table the center of the plan.'},
    {k:'image',label:'Project image',t:'img',def:'asset:reading-room'},
    {k:'alt',label:'Image description',t:'text',def:'Fictional reading room beneath retained oak trusses'},
    {k:'link',label:'Project destination',t:'link',def:'contact.html'},
    {k:'action',label:'Project action',t:'text',def:'Discuss a similar project'},
  ]};
}
const project=(values:Record<string,string>={})=>{const n=box('project-instance',[]);n.use='project-record';n.vals={title:'Workshop reading room',category:'Adaptive reuse',description:'Retain the shell. Open the garden edge. Make one shared table the center of the plan.',image:'asset:reading-room',alt:'Fictional reading room beneath retained oak trusses',link:'contact.html',action:'Discuss a similar project',...values};return n;};
const header=()=>section('header',[box('header-row',[
  named(N('heading',{text:'Common Ground',level:'div',ts:'wordmark',link:'index.html'},{d:{margin:'0','white-space':'nowrap','flex-shrink':'0'},t:{},m:{}}),'wordmark'),
  named(N('nav',{collapse:'900',aria:'Main navigation',items:[{label:'Projects',href:'projects.html'},{label:'About',href:'about.html'},{label:'Services',href:'services.html'},{label:'Contact',href:'contact.html'}]},{d:{'--nav-gap':'28px','--nav-panel':C('paper'),'--nav-hover':C('brand'),color:C('ink'),'font-size':'16px'},t:{},m:{}}),'navigation')
],{display:'flex','justify-content':'space-between','align-items':'center',gap:'24px'})],{padding:'24px 32px'});
const footer=()=>section('footer',[text('<p>Common Ground is a fictional architecture practice. Projects and AI-generated imagery are demonstration content, not completed commissions.</p>','small',{'max-width':'76ch',color:C('muted')}),link('Explore the projects','projects.html')],{'border-top-width':'1px','border-top-style':'solid','border-top-color':C('line'),padding:'32px'});
function home():Page{return {id:'page-home',name:'Home',slug:'index',title:'Common Ground — Homes and shared places',desc:'A fictional architecture practice exploring homes and adaptive reuse.',ogImage:'asset:courtyard-house',tree:[
 section('opening',[grid('project-directory',[
  box('directory',[heading('Homes and\nshared places.','h1'),text('<p>An architecture practice working across homes and places shared by a neighborhood.</p>','body',{'margin-top':'24px','max-width':'34ch'}),box('project-index',[link('Courtyard house','project-detail.html'),link('Workshop reading room','projects.html#reading-room')],{display:'flex','flex-direction':'column','margin-top':'24px',gap:'4px'})]),
  box('featured-project',[anchor(image('courtyard-house','Fictional pale-brick courtyard house with oak-framed openings',true),'courtyard'),text('<p>Courtyard house · Residential study</p>','small',{'margin-top':'16px'})])
 ])]),
 anchor(section('projects',[project()],{'background-color':C('project-surface')}),'projects'),
 anchor(section('practice',[heading('Work with what is there.'),text('<p>A useful starting point is the place itself: how daylight enters, what can be retained, and how people move through the day. This sample practice uses those observations to shape homes and shared buildings.</p>','lead',{'max-width':'60ch','margin-top':'24px'})]),'practice'),
 anchor(section('contact',[heading('Tell us about your place.'),text('<p>Start with the location, the building as it is now, and what you would like to change.</p>','body',{'max-width':'60ch','margin-top':'20px'}),named(N('form',{mode:'external',action:'',aria:'Project inquiry',submit:'Send inquiry',fields:[{label:'Name',name:'name',type:'text',required:1,half:1},{label:'Email',name:'email',type:'email',required:1,half:1},{label:'About the project',name:'project',type:'textarea',required:1}]},{d:{'max-width':'680px','margin-top':'32px','font-size':'18px','--f-bg':C('paper'),'--f-radius':'0','--f-btn-bg':C('ink'),'--f-btn-fg':C('paper')},t:{},m:{}}),'inquiry-form')]),'contact')
]};}

function page(id:string,name:string,title:string,desc:string,tree:Node[]):Page {
 return {id:`page-${id}`,name,slug:id,title:`${title} — Common Ground`,desc,tree};
}
const intro=(name:string,title:string,copy:string)=>section(name,[heading(title,'h1'),text(`<p>${copy}</p>`,'lead',{'max-width':'58ch','margin-top':'24px'})]);
const reading=(name:string,title:string,copy:string)=>box(name,[heading(title),text(`<p>${copy}</p>`,'body',{'margin-top':'20px','max-width':'58ch'})],{'max-width':'780px'});
const inquiryLink=()=>section('inquiry-link',[heading('Have a place in mind?'),text('<p>Tell us what is there now and what you would like to change.</p>','body',{'margin-top':'20px'}),link('Start a project conversation','contact.html')],{'background-color':C('project-surface')});
function projects():Page {
 return page('projects','Projects','Project studies','Two fictional studies in residential architecture and adaptive reuse.',[
  intro('projects-intro','Two places. Different starting points.','A home organized around an open courtyard. A reading room within a retained workshop. These fictional studies explore how a building can make room for daily life.'),
  section('courtyard-record',[project({title:'Courtyard house',category:'Residential study',description:'A sheltered outdoor room brings light into the center of the home. Pale brick and timber give the garden edge a quiet, durable frame.',image:'asset:courtyard-house',alt:'Fictional pale-brick courtyard house with oak-framed openings',link:'project-detail.html',action:'Read the courtyard study'})]),
  anchor(section('reading-record',[project()],{'background-color':C('project-surface')}),'reading-room'),
  section('studies-note',[text('<p>These are demonstration projects, not built work or client commissions. Replace them with your own project photographs, descriptions, and permissions before publishing.</p>','small',{'max-width':'70ch',color:C('muted')})])
 ]);
}
function detail():Page {
 const scene=image('courtyard-house','Fictional courtyard study: pale brick, oak-framed openings and a planted gravel court',true);
 scene.css.d.height='620px';scene.css.t.height='460px';scene.css.m.height='330px';
 return page('project-detail','Project Detail','Courtyard house','A fictional residential study organized around daylight and a sheltered garden.',[
  section('detail-title',[link('All projects','projects.html'),heading('Courtyard house','h1'),text('<p>Residential study · Demonstration project</p>','small',{'margin-top':'20px'}),text('<p>A quiet outdoor room at the center of the home.</p>','lead',{'margin-top':'20px','max-width':'48ch'})]),
  section('detail-scene',[scene],{'padding-top':'0'}),
  section('detail-brief',[reading('brief','Begin with the garden.','The study places everyday rooms around a sheltered court. Openings face the planting, bringing a changing view and borrowed light into the home. The aim is a close relationship between the rooms people use most and the space outside.')]),
  section('detail-decisions',[box('decision-reading',[
   reading('light','Light from more than one side.','The courtyard creates an additional edge for windows and doors. Deep reveals frame the view while giving each opening a sense of shelter.'),
   reading('material','A small material palette.','Pale brick forms the enclosure. Oak marks the places where the building opens. Gravel and low planting keep the court informal and usable.'),
   reading('daily-life','Room for the ordinary day.','The court can hold a morning chair, an open door, or a view from the table. The proposal begins with those modest uses rather than a formal entrance sequence.')
  ],{display:'flex','flex-direction':'column',gap:'48px','max-width':'780px'})],{'background-color':C('project-surface')}),
  section('detail-disclosure',[text('<p>This narrative and the AI-generated scene describe a fictional design study. They do not document construction, technical performance, or a completed commission.</p>','small',{'max-width':'70ch',color:C('muted')})]),inquiryLink()
 ]);
}
function about():Page {
 return page('about','About','The practice','A demonstration architecture practice focused on homes and shared places.',[
  intro('about-intro','Work with what is there.','Common Ground is a fictional architecture practice exploring homes, existing buildings, and places a neighborhood can share.'),
  section('about-statement',[text('<p>A useful starting point is the place itself: the direction of the light, the parts worth keeping, and the way people move through a day. Those observations can become a clear brief before they become a drawing.</p>','lead',{'max-width':'58ch'}),link('See the project studies','projects.html')],{'background-color':C('project-surface')}),
  section('about-approach',[box('approach-reading',[
   reading('listen','Listen before drawing.','A project starts with the people who will use it. A conversation about routines, constraints, and expectations gives the design something concrete to answer.'),
   reading('retain','Look carefully at what remains.','Existing fabric can carry useful space, material, and character. The sample studies ask where keeping a building can be more valuable than starting again.'),
   reading('clarify','Make the decisions legible.','Plans, material samples, and plain-language notes should help a client understand what is proposed and what still needs to be resolved.')
  ],{display:'flex','flex-direction':'column',gap:'48px','max-width':'780px'})]),
  section('about-demo',[text('<p>For template owners: replace this demonstration practice description with your own team, experience, and professional information. No people, registrations, or credentials are implied here.</p>','small',{'max-width':'70ch',color:C('muted')})]),inquiryLink()
 ]);
}
function services():Page {
 const scope=(name:string,title:string,copy:string,output:string)=>section(name,[grid(`${name}-scope`,[
  reading(`${name}-description`,title,copy),box(`${name}-outputs`,[heading('What this stage can clarify','h3'),text(`<p>${output}</p>`,'body',{'margin-top':'20px'})])
 ],'1.2fr 1fr')]);
 return page('services','Services','Ways to work together','Example architecture service scopes for a residential and adaptive reuse practice.',[
  intro('services-intro','From a first question to a clear brief.','The following scopes are examples for this demonstration practice. Actual services, fees, appointments, and responsibilities should be agreed for each project.'),
  scope('feasibility','Early feasibility','Explore whether the building or site can support the uses you have in mind. Begin with the brief, existing information, and the constraints that need further investigation.','A working brief, a record of key constraints, and options for the next stage.'),
  scope('homes','Homes and alterations','Consider how rooms, light, and outdoor space can work together. The study may begin with an existing house or with a new arrangement on a site.','An outline spatial proposal, a material direction, and the decisions requiring specialist advice.'),
  scope('reuse','Existing and shared buildings','Explore a new use for a retained building. Pay attention to what can stay, how people enter and circulate, and what makes a shared room useful.','A reuse strategy, an outline layout, and a list of technical questions for the project team.'),
  section('prepare',[heading('Before the first conversation'),text('<p>Bring the location, photographs or existing drawings if available, the uses you have in mind, and any known constraints. A rough sense of timing and budget helps frame a useful discussion.</p>','body',{'max-width':'58ch','margin-top':'24px'}),link('Tell us about the project','contact.html')],{'background-color':C('project-surface')})
 ]);
}

export function buildTemplateDocument():Doc {
 Core.seed();serial=0;
 const tokens=Core.defaultTokens();
 const palette:Record<string,string>={bg:'#faf9f6',ink:'#242c27',text:'#242c27',paper:'#faf9f6',brand:'#6c472f',muted:'#586059',line:'#c7cbc5','project-surface':'#e9edf0'};
 const colorNames:Record<string,string>={bg:'Page background',ink:'Ink',text:'Body text',paper:'Paper',brand:'Terracotta',muted:'Secondary text',line:'Divider',
    'project-surface':'Project surface'};
 tokens.colors=Object.entries(palette).map(([id,value])=>({id,name:colorNames[id],value}));
 const sizes:Record<string,[string,string]>={display:['48px','36px'],title:['34px','28px'],subtitle:['24px','22px'],lead:['21px','19px'],body:['18px','17px'],small:['14px','14px'],btn:['16px','16px']};
 for(const t of tokens.text)if(sizes[t.id])t.css={d:{'font-size':sizes[t.id][0],'font-weight':'400','line-height':['display','title'].includes(t.id)?'1.12':'1.6','letter-spacing':['display','title'].includes(t.id)?'-.035em':'0'},t:{},m:{'font-size':sizes[t.id][1]}};
 tokens.text.push({id:'wordmark',name:'Practice name',tag:'div',css:{d:{'font-size':'23px','font-weight':'400','letter-spacing':'-.04em','line-height':'1.2'},t:{},m:{}}});
 Core.state.meta={...Core.state.meta,name:'Common Ground',maxWidth:'1200px',size:'18px',lang:'en',font:'Arial, sans-serif',headFont:'Arial, sans-serif',css:'',headHtml:'',baseUrl:'',ogImage:'asset:courtyard-house',favicon:'',blocks:[],components:[projectDefinition()],collections:[],selfHostFonts:0,tokens};
 Core.state.header=[header()];Core.state.footer=[footer()];
 const homePage=home();
 const contactForm=homePage.tree.pop()!;
 const contactHeading=contactForm.children[0];contactHeading.props.level='h1';contactHeading.props.ts='display';
 homePage.tree.push(inquiryLink());
 const contactPage=page('contact','Contact','Start a conversation','Describe the place, the building, and the change you have in mind.',[
  contactForm,
  section('contact-next',[reading('next-step','A useful first message.','Include the location, whether this is an existing building or a new site, and the main change you want to make. Avoid sending sensitive documents until you have agreed how they will be handled.')]),
  section('contact-setup',[text('<p>This demonstration form is not connected to a receiving service. The template owner must configure and test delivery before accepting inquiries.</p>','small',{'max-width':'70ch',color:C('muted')})])
 ]);
 Core.state.pages=[homePage,projects(),detail(),about(),services(),contactPage];Core.state.cur=0;
 return structuredClone(Core.doc());
}
