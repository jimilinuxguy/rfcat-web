import { bitsOf, packWaveform, pulseEncode, makeOokAnalysis, configureOok, transmitOok, repeatFields, bitsFromBytes, decodePulseBits, valueFromBits } from "./retekess-common.js";
function range(n,min,max,label){n=Number(n);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${label} must be ${min}–${max}`);return n;}
function encodePrinceton({station,pager,action=0,stationBits=13,pagerBits=10,actionBits=1,reverseFields=true,te=271,frames=10,trailingBit=""}){
 station=range(station,0,2**stationBits-1,"Station");pager=range(pager,0,2**pagerBits-1,"Pager");action=range(action,0,2**actionBits-1,"Action");
 const opt={lsb:reverseFields}; const logical=bitsOf(station,stationBits,opt)+bitsOf(pager,pagerBits,opt)+bitsOf(action,actionBits,opt)+trailingBit;
 const frame=pulseEncode(logical,{zero:[1,3],one:[3,1],suffix:"0".repeat(22)});
 const waveform=frame.repeat(Number(frames)); const {bytes,padding}=packWaveform(waveform);
 return {bytes,waveform,padding,logical,station,pager,action,te,frames:Number(frames)};
}
export function decodeRetekessPrinceton(bytes,{stationBits=13,pagerBits=10,actionBits=1,reverseFields=true,trailingBit="",sampleScale=1}={}){
 const bits=bitsFromBytes(bytes), logicalLen=stationBits+pagerBits+actionBits+trailingBit.length, encodedLen=logicalLen*4;

 // Keep exact decoding for generated/reference frames.
 for(let start=0;start+encodedLen<=bits.length;start++){
  const logical=decodePulseBits(bits.slice(start,start+encodedLen));
  if(!logical||logical.length!==logicalLen)continue;
  if(trailingBit&&logical.slice(-trailingBit.length)!==trailingBit)continue;
  let at=0;const station=valueFromBits(logical.slice(at,at+=stationBits),{lsb:reverseFields});const pager=valueFromBits(logical.slice(at,at+=pagerBits),{lsb:reverseFields});const action=valueFromBits(logical.slice(at,at+actionBits),{lsb:reverseFields});
  return {fields:{station,pager,action,payloadBits:logical},summary:`station ${station} · pager ${pager} · action ${action} · bits ${logical}`,bitOffset:start};
 }

 // OTA raw OOK is asynchronously sampled. Build runs, suppress one-sample
 // glitches, then use the long LOW frame gap to anchor the preceding symbols.
 const runs=[];for(let i=0;i<bits.length;){const level=bits[i];let e=i+1;while(e<bits.length&&bits[e]===level)e++;runs.push({level,start:i,length:e-i});i=e;}
 for(let i=1;i+1<runs.length;){if(runs[i].length<=1&&runs[i-1].level===runs[i+1].level){runs[i-1].length+=runs[i].length+runs[i+1].length;runs.splice(i,2);continue;}i++;}
 for(let gap=0;gap<runs.length;gap++){
  if(runs[gap].level!=="0"||runs[gap].length<14*sampleScale)continue;
  const first=gap-logicalLen*2;if(first<0)continue;
  let logical="",error=0,ok=true;
  for(let i=first;i<gap;i+=2){
   const hi=runs[i],lo=runs[i+1];if(!hi||!lo||hi.level!=="1"||lo.level!=="0"){ok=false;break;}
   const total=hi.length+lo.length;if(total<2*sampleScale||total>7*sampleScale){ok=false;break;}
   const zeroError=Math.abs(hi.length-sampleScale)+Math.abs(lo.length-3*sampleScale),oneError=Math.abs(hi.length-3*sampleScale)+Math.abs(lo.length-sampleScale),best=Math.min(zeroError,oneError);
   if(best>3*sampleScale){ok=false;break;}logical+=zeroError<=oneError?"0":"1";error+=best;
  }
  if(!ok||logical.length!==logicalLen)continue;
  if(trailingBit&&logical.slice(-trailingBit.length)!==trailingBit)continue;
  let at=0;const station=valueFromBits(logical.slice(at,at+=stationBits),{lsb:reverseFields});const pager=valueFromBits(logical.slice(at,at+=pagerBits),{lsb:reverseFields});const action=valueFromBits(logical.slice(at,at+actionBits),{lsb:reverseFields});
  return {fields:{station,pager,action,payloadBits:logical},summary:`station ${station} · pager ${pager} · action ${action} · bits ${logical}`,bitOffset:runs[first].start,timingError:error};
 }
 return null;
}
function makeProtocol({id,name,frequency=433920000,stationBits=13,pagerBits=10,actionBits=1,reverseFields=true,te=271,trailingBit="",pagerMax=999,fixedAction=null,broadcastPager=null,broadcastAction=null,rxPreset=null}){
 return {id,name,menuGroup:"Restaurant Pagers",description:`${name} documented OOK single-pager framing.`,rxPreset,decode(bytes){return decodeRetekessPrinceton(bytes,{stationBits,pagerBits,actionBits,reverseFields,trailingBit,sampleScale:rxPreset?.sampleScale??1});},
 fields:[{id:"station",label:"Station",type:"number",min:0,max:2**stationBits-1,value:0},{id:"pager",label:"Pager",type:"number",min:0,max:pagerMax,value:1},...(fixedAction===null?[{id:"action",label:"Action",type:"number",min:0,max:2**actionBits-1,value:0}]:[]),{id:"sequenceEnd",label:"Sequence through pager",type:"number",min:0,max:pagerMax,value:1},...(broadcastPager===null?[]:[{id:"broadcast",label:"All pagers",type:"checkbox",value:false}]),{id:"frames",label:"Frames",type:"number",min:1,max:20,value:10},...repeatFields(0)],
 encode(v){const e=encodePrinceton({...v,action:fixedAction??v.action,stationBits,pagerBits,actionBits,reverseFields,te,trailingBit});return {...e,bits:e.logical,analysis:makeOokAnalysis(e.waveform,1e6/te,`${name} OOK`,[{name:"TE",symbols:1,requestedUs:te}]),modulation:"ASK/OOK",summary:`${name} TX: station ${e.station} · pager ${e.pager} · action ${e.action}`};},
 async configure(d){await configureOok(d,frequency,1e6/te);},async transmit(d,e,v){const start=Number(v.pager),end=Math.max(start,Number(v.sequenceEnd??start));const targets=v.broadcast&&broadcastPager!==null?[broadcastPager]:Array.from({length:end-start+1},(_,i)=>start+i);for(const pager of targets){const next=encodePrinceton({...v,pager,action:v.broadcast&&broadcastAction!==null?broadcastAction:(fixedAction??v.action),stationBits,pagerBits,actionBits,reverseFields,te,trailingBit});await transmitOok(d,next.bytes,v);}}};
}
export const retekessT119=makeProtocol({id:"retekess-t119",name:"Retekess T119",broadcastPager:1005,broadcastAction:0,rxPreset:{frequency:433_920_000,dataRate:3690.036900369004,bandwidth:93_750,modulation:0x30,syncWord:0x0000,syncMode:0,manchester:false,lengthMode:"fixed",packetLength:255,crc:false,whitening:false,appendStatus:false,addressCheck:0,deviceAddress:0,lowball:true}});
export const retekessTd165=makeProtocol({id:"retekess-td165",name:"Retekess TD165",broadcastPager:1005,broadcastAction:0,rxPreset:{frequency:433_920_000,dataRate:3690.036900369004,bandwidth:93_750,modulation:0x30,syncWord:0x0000,syncMode:0,manchester:false,lengthMode:"fixed",packetLength:255,crc:false,whitening:false,appendStatus:false,addressCheck:0,deviceAddress:0,lowball:true}});
export const retekessTd157=makeProtocol({id:"retekess-td157",name:"Retekess TD157",stationBits:10,pagerBits:10,actionBits:4,reverseFields:false,te:212,fixedAction:2,broadcastPager:999,broadcastAction:15,rxPreset:{frequency:433_920_000,dataRate:4716.981132075472,bandwidth:93_750,modulation:0x30,syncWord:0x0000,syncMode:0,manchester:false,lengthMode:"fixed",packetLength:255,crc:false,whitening:false,appendStatus:false,addressCheck:0,deviceAddress:0,lowball:true,sampleScale:1}});
export const retekessTd174=makeProtocol({id:"retekess-td174",name:"Retekess TD174",frequency:433889000,stationBits:13,pagerBits:8,actionBits:2,reverseFields:true,te:326,trailingBit:"0",pagerMax:255,fixedAction:0,rxPreset:{frequency:433_889_000,dataRate:3067.484662576687,bandwidth:93_750,modulation:0x30,syncWord:0x0000,syncMode:0,manchester:false,lengthMode:"fixed",packetLength:255,crc:false,whitening:false,appendStatus:false,addressCheck:0,deviceAddress:0,lowball:true}});
export { encodePrinceton as encodeRetekessPrinceton };
