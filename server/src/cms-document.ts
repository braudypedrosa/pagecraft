import type { Doc } from '../../app/src/core/types.ts';
import { validateCmsEntry } from '../../app/src/core/cms-validation.ts';
import { safeRichHtml } from './safe-html.ts';

/** Validate writes, not legacy values the author did not touch. */
export function cmsDocumentErrors(before:Doc, after:Doc, assets:ReadonlySet<string>): string[] {
  const errors:string[]=[];
  const ids=new Set<string>();
  for(const col of after.meta.collections || []) {
    if(ids.has(col.id)) errors.push('Collection IDs must be unique.');
    ids.add(col.id);
    const old=before.meta.collections?.find(c=>c.id===col.id);
    const fieldIds=new Set<string>();
    for(const f of col.fields) {
      if(fieldIds.has(f.id)) errors.push(`${col.name}: field IDs must be unique.`);
      fieldIds.add(f.id);
      const prior=old?.fields.find(x=>x.id===f.id);
      if(prior && prior.type!==f.type && old!.items.some(i=>!!i.values[f.id])) errors.push(`${f.name}: populated fields cannot change type.`);
    }
    const entries=new Set<string>();
    for(const item of col.items) {
      if(entries.has(item.id)) errors.push(`${col.name}: entry IDs must be unique.`);
      entries.add(item.id);
      const previous=old?.items.find(i=>i.id===item.id);
      if(JSON.stringify(previous)===JSON.stringify(item)) continue;
      const found=validateCmsEntry(after,col,item,assets,safeRichHtml);
      errors.push(...Object.values(found).map(message=>`${col.name} / ${item.slug}: ${message}`));
    }
  }
  return errors;
}
