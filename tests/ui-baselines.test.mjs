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
