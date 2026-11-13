import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { buildDocument } from '../premade-sites/review-library/dental-clinic-a2/source.ts';

const brand = '/Users/braudypedorsa/Braudy/Projects/Pagecraft/design/dental-clinic/branding';
const assets: Record<string,string> = {
  'bp-mark': resolve('premade-sites/review-library/dental-clinic-a2/bp-mark-ink.svg'),
  'visit-consultation-detail': resolve('premade-sites/review-library/dental-clinic-a2/approved-additions/visit-consultation-detail.webp'),
  'cta-clinic-entrance': resolve('premade-sites/review-library/dental-clinic-a2/approved-additions/cta-clinic-entrance.webp'),
  'icon-preventive': resolve('premade-sites/review-library/dental-clinic-a2/approved-additions/icon-preventive.svg'),
  'icon-restorative': resolve('premade-sites/review-library/dental-clinic-a2/approved-additions/icon-restorative.svg'),
  'icon-planning': resolve('premade-sites/review-library/dental-clinic-a2/approved-additions/icon-planning.svg'),
  'approach-conversation': resolve('premade-sites/review-library/dental-clinic-a2/approved-additions/approach-conversation.webp'),
  'care-team-scene': resolve('premade-sites/review-library/dental-clinic-a2/approved-additions/care-team-scene.webp'),
  favicon: 'revisions-v2/logos/l2-mark-primary.svg',
  logo: 'revisions-v2/logos/l2-horizontal-primary.svg',
  'logo-white': 'revisions-v2/logos/l2-horizontal-white.svg',
  'family-care-hero': 'images/family-care-hero.webp',
  'everyday-care-adult': 'images/everyday-care-adult.webp',
  'first-visit-child': 'images/first-visit-child.webp',
  'light-filled-treatment-room': 'revisions-v2/images/light-filled-treatment-room.webp',
  'care-team-portrait-01': 'revisions-v2/images/care-team-portrait-01.webp',
  'care-team-portrait-02': 'revisions-v2/images/care-team-portrait-02.webp',
  'welcoming-reception': 'revisions-v2/images/welcoming-reception.webp',
  'comfortable-consultation': 'revisions-v2/images/comfortable-consultation.webp',
  'everyday-oral-care': 'revisions-v2/images/everyday-oral-care.webp'
};
const document = buildDocument();
for (const path of Object.values(assets)) await readFile(resolve(brand,path));
if (process.argv.includes('--check')) {
  console.log(`Prepared ${document.pages.length} native pages and ${Object.keys(assets).length} available assets.`);
} else {
  const endpoint=process.env.PAGECRAFT_TEMPLATE_ENDPOINT, grant=process.env.PAGECRAFT_TEMPLATE_GRANT;
  if(!endpoint || !grant) throw new Error('Set PAGECRAFT_TEMPLATE_ENDPOINT and PAGECRAFT_TEMPLATE_GRANT before creating a draft.');
  const id='dental-clinic-a2', version='0.1.0';
  const client=new Client({name:'template-workshop',version:'1.0.0'});
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint),{authProvider:{token:async()=>grant}}));
  const call=async(name:string,input:Record<string,unknown>)=>{const response=await client.callTool({name,arguments:input});const value=JSON.parse((response.content as {text:string}[])[0].text);if(response.isError)throw new Error(`${name}: ${JSON.stringify(value)}`);return value;};
  try {
    const update=process.argv.includes('--update');
    const expectedArg=process.argv.find(arg=>arg.startsWith('--expected-revision='));
    const expected=expectedArg ? Number(expectedArg.slice('--expected-revision='.length)) : NaN;
    if(update && (!Number.isSafeInteger(expected) || expected < 1)) throw new Error('Update requires --expected-revision=<positive integer>.');
    if(!update && expectedArg) throw new Error('--expected-revision requires --update.');
    let draft;
    if(update) {
      draft=await call('pagecraft_template_read',{id,version});
      if(draft.revision!==expected) throw new Error(`Revision mismatch: expected ${expected}, current ${draft.revision}. No changes were made.`);
    } else {
      const existing=await call('pagecraft_template_list',{});
      if(existing.some((row:{id:string;version:string})=>row.id===id&&row.version===version)) throw new Error('Draft already exists. Inspect it before choosing a new version; no changes were made.');
      draft=await call('pagecraft_template_create',{id,version,name:'Linden Dental'});
    }
    const mapping:Record<string,string>={};
    // Check all names before any upload so ambiguity cannot leave a partial update.
    for(const [key,path] of Object.entries(assets)) {
      const name=path.split('/').at(-1);
      const matches=draft.assets.filter((asset:{name:string})=>asset.name===name);
      if(matches.length>1) throw new Error(`Ambiguous existing asset filename: ${name}. No upload was attempted.`);
      if(matches.length===1) mapping[key]=matches[0].id;
    }
    for(const [key,path] of Object.entries(assets)) {
      if(mapping[key]) continue;
      const bytes=await readFile(resolve(brand,path));
      draft=await call('pagecraft_template_upload_image',{id,version,revision:draft.revision,name:path.split('/').at(-1),base64:bytes.toString('base64')});
      if(!draft.uploadedAssetId)throw new Error(`Upload did not return an asset ID for ${key}.`);
      mapping[key]=draft.uploadedAssetId;
    }
    let source=JSON.stringify(document);
    for(const [key,assetId] of Object.entries(mapping).sort(([a],[b])=>b.length-a.length)) source=source.replaceAll(`asset:${key}`,`asset:${assetId}`);
    draft=await call('pagecraft_template_save',{id,version,revision:draft.revision,document:JSON.parse(source)});
    const validated=await call('pagecraft_template_validate',{id,version,revision:draft.revision});
    console.log(JSON.stringify({id,version,revision:draft.revision,packageSha256:validated.packageSha256,editorUrl:draft.editorUrl,previewUrl:draft.previewUrl}));
  } finally {await client.close();}
}
