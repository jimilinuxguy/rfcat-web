import { bitsOf, packWaveform, pulseEncode, makeOokAnalysis, configureOok, transmitOok, repeatFields, bitsFromBytes, decodePulseBits, valueFromBits } from "./retekess-common.js";
function bcd3(n){n=Number(n);if(!Number.isInteger(n)||n<0||n>999)throw new Error("Value must be 0–999");return [n%10,Math.floor(n/10)%10,Math.floor(n/100)%10];}
export function encodeRetekessTd161({systemId,pagerId,alertType=0,frames=30}){
 const p=bcd3(pagerId),s=bcd3(systemId); alertType=Number(alertType);
 if(!Number.isInteger(alertType)||alertType<0||alertType>4)throw new Error("Alert type must be 0–4");
 const nibbles=[...p,alertType,...s,0,0];
 let logical=""; for(const n of nibbles) logical+=bitsOf(n,4,{lsb:true});
 const frame=pulseEncode(logical,{zero:[1,3],one:[3,1],suffix:"0".repeat(28)});
 const waveform=frame.repeat(Number(frames)); const {bytes,padding}=packWaveform(waveform);
 return {bytes,waveform,padding,logical,systemId:Number(systemId),pagerId:Number(pagerId),alertType,frames:Number(frames)};
}
function td161Fields(logical,bitOffset,timingError){
 const nib=[];for(let i=0;i<36;i+=4)nib.push(valueFromBits(logical.slice(i,i+4),{lsb:true}));
 const [p1,p10,p100,alert,s1,s10,s100,z1,z2]=nib;
 if([p1,p10,p100,s1,s10,s100].some(n=>n>9)||z1!==0||z2!==0||alert>4)return null;
 const pagerId=p100*100+p10*10+p1,systemId=s100*100+s10*10+s1;
 return {fields:{systemId,pagerId,alertType:alert,payloadBits:logical},summary:`TD161 system ${systemId} · pager ${pagerId} · function ${alert} · bits ${logical}`,bitOffset,...(timingError==null?{}:{timingError})};
}
export function decodeRetekessTd161(bytes){
 const bits=bitsFromBytes(bytes);
 // Exact generated/reference frame.
 for(let start=0;start+172<=bits.length;start++){
  const logical=decodePulseBits(bits.slice(start,start+144));if(!logical||logical.length!==36)continue;
  if(bits.slice(start+144,start+172)!=="0".repeat(28))continue;
  const decoded=td161Fields(logical,start);if(decoded)return decoded;
 }
 // OTA raw OOK: tolerate asynchronous CC1111 sampling and use the
 // seven-symbol LOW trailer as the frame anchor.
 const runs=[];for(let i=0;i<bits.length;){const level=bits[i];let e=i+1;while(e<bits.length&&bits[e]===level)e++;runs.push({level,start:i,length:e-i});i=e;}
 for(let i=1;i+1<runs.length;){if(runs[i].length<=1&&runs[i-1].level===runs[i+1].level){runs[i-1].length+=runs[i].length+runs[i+1].length;runs.splice(i,2);continue;}i++;}
 for(let gap=0;gap<runs.length;gap++){
  if(runs[gap].level!=="0"||runs[gap].length<20)continue;
  const first=gap-72;if(first<0)continue;
  let logical="",error=0,ok=true;
  for(let i=first;i<gap;i+=2){
   const hi=runs[i],lo=runs[i+1];if(!hi||!lo||hi.level!=="1"||lo.level!=="0"){ok=false;break;}
   const total=hi.length+lo.length;if(total<2||total>7){ok=false;break;}
   const z=Math.abs(hi.length-1)+Math.abs(lo.length-3),o=Math.abs(hi.length-3)+Math.abs(lo.length-1),best=Math.min(z,o);
   if(best>3){ok=false;break;}logical+=z<=o?"0":"1";error+=best;
  }
  if(!ok||logical.length!==36)continue;
  const decoded=td161Fields(logical,runs[first].start,error);if(decoded)return decoded;
 }
 return null;
}
const protocol={id:"retekess-td161",name:"Retekess TD161",menuGroup:"Restaurant Pagers",decoderGroup:"Retekess",description:"Retekess TD161 36-bit OOK pager framing.",rxPreset:{frequency:433_920_000,dataRate:5000,bandwidth:93_750,modulation:0x30,syncWord:0x0000,syncMode:0,manchester:false,lengthMode:"fixed",packetLength:255,crc:false,whitening:false,appendStatus:false,addressCheck:0,deviceAddress:0,lowball:true},decode(bytes){return decodeRetekessTd161(bytes);},
 fields:[{id:"systemId",label:"System ID",type:"number",min:0,max:999,value:0},{id:"pagerId",label:"Pager ID",type:"number",min:0,max:999,value:1},{id:"sequenceEnd",label:"Sequence through pager",type:"number",min:0,max:999,value:1},{id:"allPagers",label:"All pagers",type:"checkbox",value:false},{id:"alertType",label:"Function",type:"number",min:0,max:4,value:0},{id:"frames",label:"Frames",type:"number",min:1,max:30,value:30},...repeatFields(0)],
 encode(v){const e=encodeRetekessTd161(v);return {...e,bits:e.logical,analysis:makeOokAnalysis(e.waveform,5000,"Retekess TD161 OOK",[{name:"Base symbol",symbols:1,requestedUs:200}]),modulation:"ASK/OOK",summary:`Retekess TD161 TX: system ${e.systemId} · pager ${e.pagerId} · function ${e.alertType}`};},
 async configure(d){await configureOok(d,433_920_000,5000);},async transmit(d,e,v){const start=Number(v.pagerId),end=Math.max(start,Number(v.sequenceEnd??start));const targets=v.allPagers?[999]:Array.from({length:end-start+1},(_,i)=>start+i);for(const pagerId of targets){const next=encodeRetekessTd161({...v,pagerId,alertType:v.allPagers?0:v.alertType});await transmitOok(d,next.bytes,v);}}};
export default protocol;
