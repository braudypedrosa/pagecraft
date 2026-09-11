import {test,expect} from 'vitest';
import {uiFixtureDocument,QA_SITE_NAME} from '../tools/fixtures/ui-site.ts';
import {cmsDocumentErrors} from '../server/src/cms-document.ts';
import {blankDoc,renderSite} from '../server/src/render.ts';
test('the fictional UI fixture renders native pages/forms and valid paginated CMS content',()=>{
 const doc=uiFixtureDocument();
 expect(doc.pages).toHaveLength(2);
 expect(doc.meta.collections[0].items).toHaveLength(27);
 expect(doc.meta.collections[1].items).toHaveLength(0);
 expect(cmsDocumentErrors(blankDoc(QA_SITE_NAME),doc,new Set())).toEqual([]);
 const rendered=renderSite(doc);
 expect(rendered.files.get('index.html')).toContain('Community workshops');
 expect(rendered.files.get('index.html')).toContain('<form');
 expect(JSON.stringify(doc)).not.toMatch(/itspagecraft\.com|supabase\.co|@gmail|api_key|secret/i);
 const next=uiFixtureDocument();doc.pages[0].name='Changed locally';
 expect(next.pages[0].name).toBe('Home');
});
