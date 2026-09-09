// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { buildTemplateDocument } from '../premade-sites/architecture-studio/1.1.0/source.ts';
import { renderSite } from '../server/src/render.ts';
import type { Node } from '../app/src/core/types.ts';
const all=(tree:Node[]):Node[]=>tree.flatMap(n=>[n,...all(n.children)]);
it('exposes an actual native image picker and leaves typography connected to global settings',()=>{
 const d=buildTemplateDocument(),component=d.meta.components!.find(c=>c.id==='project-plate')!;
 expect(component.props.find(p=>p.k==='image')?.t).toBe('img');
 for(const id of ['display','title','subtitle'])expect(d.meta.tokens!.text.find(t=>t.id===id)?.css.d['font-family']).toBeUndefined();
 for(const id of ['body','lead','small'])expect(d.meta.tokens!.text.find(t=>t.id===id)?.css.d['font-family']).toBe('inherit');
 expect(d.meta.css).toBe('');expect(d.meta.headHtml).toBe('');
});
it.each([1,3,7])('preserves %i independent project plates and omits missing imagery',count=>{
 const d=buildTemplateDocument();const parent=all(d.pages[0].tree).find(n=>n.children.some(c=>c.use==='project-plate'))!;const base=parent.children[0];
 parent.children=Array.from({length:count},(_,i)=>{const n=structuredClone(base);n.id=`redesign-stress-${i}`;n.vals={...n.vals,title:`Independent ${i} — a much longer courtyard house project heading`,description:i%2?'Short.':'Daylight, enclosure and a shared threshold are tested in this deliberately longer project description.',...(i===0?{image:''}:{})};return n;});
 const page=new DOMParser().parseFromString(renderSite(d).files.get('index.html')!,'text/html');
 for(const [i,n] of parent.children.entries()){const element=page.getElementById(`pagecraft-box-${n.id}`)!;expect(element.querySelector('h2')?.textContent).toBe(n.vals!.title);expect(element.querySelectorAll('img')).toHaveLength(i===0?0:1);expect([...element.querySelectorAll('p')].some(p=>p.textContent===n.vals!.description)).toBe(true);}
});

it('keeps explicit spacing stable when a native save canonicalizes CSS key order',()=>{
 const d=buildTemplateDocument();
 const nodes=[...all(d.header),...all(d.footer),...d.pages.flatMap(p=>all(p.tree)),...d.meta.components!.flatMap(c=>all([c.node]))];
 for(const n of nodes)for(const bp of ['d','t','m'] as const){expect(n.css[bp]).not.toHaveProperty('padding');expect(n.css[bp]).not.toHaveProperty('margin');}
 const hero=d.pages[0].tree[0];expect(hero.css.d['padding-top']).toBe('0');expect(hero.css.d['padding-right']).toBe('48px');
 const original=renderSite(d).files.get('index.html')!;
 for(const n of nodes)for(const bp of ['d','t','m'] as const)n.css[bp]=Object.fromEntries(Object.entries(n.css[bp]).sort(([a],[b])=>a.localeCompare(b)));
 const sorted=renderSite(d).files.get('index.html')!;
 for(const output of [original,sorted])expect(output).toContain('padding-top:0;');
});
