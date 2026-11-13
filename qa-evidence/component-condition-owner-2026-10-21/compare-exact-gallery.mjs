import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import crypto from 'node:crypto';
const out=new URL('./',import.meta.url), gallery=new URL('./gallery/',out);
const names=(await fs.readdir(gallery)).filter(n=>n.endsWith('.png')).sort();
const report={reference:'git HEAD:public/internal-ui-baselines/',candidate:'gallery/',comparison:'RGBA decoded pixels, exact nonzero channel differences and existing >20 RGB threshold',images:{}};
const cells=[]; const thumbWidth=360; let top=0;
for(const name of names){
 const reference=execFileSync('git',['show',`HEAD:public/internal-ui-baselines/${name}`]);
 const candidate=await fs.readFile(new URL(name,gallery));
 const a=await sharp(reference).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const b=await sharp(candidate).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(a.info.width!==b.info.width||a.info.height!==b.info.height)throw Error('Dimension mismatch '+name);
 const {width,height}=a.info; let pixels=0, channels=0, thresholdPixels=0,maxDelta=0,minX=width,minY=height,maxX=-1,maxY=-1;
 const mask=Buffer.alloc(width*height*3,255);
 for(let p=0;p<width*height;p++){
  let changed=false,threshold=false;
  for(let c=0;c<4;c++){const d=Math.abs(a.data[p*4+c]-b.data[p*4+c]);if(d){changed=true;channels++;maxDelta=Math.max(maxDelta,d);}if(c<3&&d>20)threshold=true;}
  if(threshold)thresholdPixels++;
  if(changed){pixels++;const x=p%width,y=Math.floor(p/width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);mask[p*3]=255;mask[p*3+1]=0;mask[p*3+2]=0;}
 }
 let byteOffsets=0; for(let i=0;i<Math.max(reference.length,candidate.length);i++)if(reference[i]!==candidate[i])byteOffsets++;
 report.images[name]={width,height,bytesIdentical:reference.equals(candidate),referenceBytes:reference.length,candidateBytes:candidate.length,differingByteOffsets:byteOffsets,referenceSHA256:crypto.createHash('sha256').update(reference).digest('hex'),candidateSHA256:crypto.createHash('sha256').update(candidate).digest('hex'),decodedPixelsChanged:pixels,decodedChannelsChanged:channels,maxChannelDelta:maxDelta,thresholdPixelsChanged:thresholdPixels,exactBounds:pixels?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null};
 if(pixels||!reference.equals(candidate)){
  const h=Math.round(height*thumbWidth/width), title=Buffer.from(`<svg width="1080" height="38"><rect width="1080" height="38" fill="white"/><text x="8" y="24" font-family="Arial" font-size="16">${name}: HEAD | candidate | exact pixel diff (${pixels} pixels)</text></svg>`);
  cells.push({input:title,left:0,top});top+=38;
  for(const [i,img]of [reference,candidate,await sharp(mask,{raw:{width,height,channels:3}}).png().toBuffer()].entries())cells.push({input:await sharp(img).resize({width:thumbWidth}).png().toBuffer(),left:i*thumbWidth,top});
  top+=h+12;
  if(pixels){
   const region={left:Math.max(0,minX-28),top:Math.max(0,minY-15),width:Math.min(80,width-Math.max(0,minX-28)),height:Math.min(60,height-Math.max(0,minY-15))};
   const label=Buffer.from(`<svg width="1080" height="30"><rect width="1080" height="30" fill="white"/><text x="8" y="21" font-family="Arial" font-size="15">Changed region enlarged: HEAD | candidate | exact diff</text></svg>`);
   cells.push({input:label,left:0,top});top+=30;
   for(const [i,img]of [reference,candidate,await sharp(mask,{raw:{width,height,channels:3}}).png().toBuffer()].entries())cells.push({input:await sharp(img).extract(region).resize({width:360,kernel:'nearest'}).png().toBuffer(),left:i*360,top});
   top+=270+12;
  }
 }
}
report.summary={images:names.length,byteChanged:Object.values(report.images).filter(v=>!v.bytesIdentical).length,pixelChanged:Object.values(report.images).filter(v=>v.decodedPixelsChanged).length,totalChangedPixels:Object.values(report.images).reduce((n,v)=>n+v.decodedPixelsChanged,0)};
await fs.writeFile(new URL('gallery-exact-comparison.json',out),JSON.stringify(report,null,2)+'\n');
if(cells.length)await sharp({create:{width:1080,height:top,channels:3,background:'#d8d8d8'}}).composite(cells).png().toFile(new URL('gallery-exact-contact-sheet.png',out).pathname);
console.log(JSON.stringify({summary:report.summary,changes:Object.entries(report.images).filter(([,v])=>!v.bytesIdentical||v.decodedPixelsChanged).map(([name,v])=>({name,...v}))},null,2));
