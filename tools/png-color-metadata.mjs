import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const hash=value=>createHash('sha256').update(value).digest('hex');
const colorChunkNames=new Set(['iCCP','sRGB','gAMA','cHRM']);

export function pngColorMetadata(input){
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input);
 if(bytes.length<8||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Capture is not a PNG.');
 const chunks={iCCP:[],sRGB:[],gAMA:[],cHRM:[]};
 for(let offset=8;offset+12<=bytes.length;){
  const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),start=offset+8,end=start+length;
  if(end+4>bytes.length)throw new Error('Capture has a truncated PNG chunk.');
  const data=bytes.subarray(start,end);
  if(colorChunkNames.has(type)){
   if(type==='iCCP'){
    const separator=data.indexOf(0),name=separator<0?'':data.toString('latin1',0,separator).replace(/[^\x20-\x7e]/g,'').slice(0,79),compressed=separator<0?Buffer.alloc(0):data.subarray(separator+2);
    let profile=null;try{profile=inflateSync(compressed);}catch{}
    chunks.iCCP.push({name,compressionMethod:separator<0?null:data[separator+1],compressedBytes:compressed.length,compressedSha256:hash(compressed),profileBytes:profile?.length??null,profileSha256:profile?hash(profile):null});
   }else if(type==='sRGB')chunks.sRGB.push(data.length?data[0]:null);
   else if(type==='gAMA')chunks.gAMA.push(data.length===4?bytes.readUInt32BE(start):null);
   else chunks.cHRM.push(data.length===32?Array.from({length:8},(_,index)=>bytes.readUInt32BE(start+index*4)):null);
  }
  offset=end+4;if(type==='IEND')break;
 }
 const metadata={chunks};
 return {...metadata,signature:hash(JSON.stringify(metadata))};
}
