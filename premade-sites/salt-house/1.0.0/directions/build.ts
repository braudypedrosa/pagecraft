import {mkdir,writeFile} from 'node:fs/promises';
import * as Core from '../../../../app/src/core/index.ts';
import {buildDirection} from './source.ts';
for(const id of ['coastline','guestbook','collection'] as const){const doc=buildDirection(id);await mkdir(new URL('./',import.meta.url),{recursive:true});await writeFile(new URL(id+'.json',import.meta.url),JSON.stringify(doc,null,2));await writeFile(new URL(id+'.html',import.meta.url),Core.buildPage(Core.state.pages[0]));}
