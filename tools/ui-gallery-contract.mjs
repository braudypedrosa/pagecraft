import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {UI_FONT_FACES} from '../shared/ui-fonts.js';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const directory=resolve(root,'public/internal-ui-baselines');
export const sources=['builder.html','shared/ui-tokens.js','shared/ui-fonts.js','shared/ui-typography.js','shared/ui-focus.js','shared/workspace-styles.js','shared/dialog-styles.js','shared/custom-select.js','shared/action-feedback.js','server/src/account-pages.ts','server/src/component-gallery.ts',...UI_FONT_FACES.map(font=>'brand/fonts/'+font.file)];
export const names=['cloud','builder'].flatMap(host=>['fields','actions','tables','menus','dialogs','feedback'].flatMap(section=>[1440,768].map(width=>`${host}-${section}-${width}.png`)));
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function sourceHashes(){return Object.fromEntries(await Promise.all(sources.map(async file=>[file,hash(await readFile(resolve(root,file)))])));}
