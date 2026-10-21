import {test,expect} from 'vitest';
import sharp from 'sharp';
import {checkBaselines,compareImages} from '../tools/ui-baselines.mjs';
test('reviewed gallery baselines match the current shared UI sources',async()=>{expect((await checkBaselines()).images).toBe(24);});
test('PNG comparison accepts identical images and flags visible changes or resized captures',async()=>{
 const a=await sharp({create:{width:50,height:50,channels:3,background:'#fff'}}).png().toBuffer();
 const b=await sharp({create:{width:50,height:50,channels:3,background:'#111'}}).png().toBuffer();
 const c=await sharp({create:{width:60,height:50,channels:3,background:'#fff'}}).png().toBuffer();
 expect((await compareImages(a,a)).passed).toBe(true);expect((await compareImages(a,b)).passed).toBe(false);expect((await compareImages(a,c)).reason).toBe('Image dimensions changed');
});

test('inspector control changes require fresh visual baseline review', async () => {
  const { sources } = await import('../tools/ui-gallery-contract.mjs');
  expect(sources).toContain('app/src/ui/inspector/Controls.tsx');
});


test('inspector mount lifecycle changes are fingerprinted for reviewed visual baselines', async () => {
  const { sources, sourceHashes } = await import('../tools/ui-gallery-contract.mjs');
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const file = 'app/src/ui/index.tsx';
  expect(sources.filter(source => source === file)).toHaveLength(1);
  const hashes = await sourceHashes();
  const actual = createHash('sha256').update(await readFile(new URL('../' + file, import.meta.url))).digest('hex');
  expect(hashes[file]).toBe(actual);
});
