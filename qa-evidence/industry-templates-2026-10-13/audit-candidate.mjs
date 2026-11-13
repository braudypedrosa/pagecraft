import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
const id=process.argv[2];
if(!['electrician-service','residential-cleaning','landscaping-studio','salon-studio','bookkeeping-practice'].includes(id)) throw new Error('Unknown candidate');
const version='1.0.0';
const folder=resolve(root,'premade-sites',id,version);
const source=await import(pathToFileURL(resolve(folder,'source.ts')).href);
const document=source.buildTemplateDocument();
const args=['tools/audit-template-library.mjs','--id',id,'--version',version,'--out',`qa-evidence/industry-templates-2026-10-13/${id}-audit.json`];
function walk(nodes,slug){for(const node of nodes){if(node.type==='form'&&!node.props.action) args.push('--allow-form-no-action',`${slug}:${node.id}`);walk(node.children||[],slug)}}
for(const page of document.pages)walk(page.tree,page.slug);
const run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
if(run.status!==0){process.stdout.write(run.stdout);process.stderr.write(run.stderr);process.exit(run.status||1)}
const report=JSON.parse(await readFile(resolve(root,`qa-evidence/industry-templates-2026-10-13/${id}-audit.json`),'utf8'));
console.log(JSON.stringify({id,...report.summary,warnings:report.templates[0].render.warnings}));
if(report.summary.renderErrors||report.summary.currentCheckPasses!==1) process.exit(1);
