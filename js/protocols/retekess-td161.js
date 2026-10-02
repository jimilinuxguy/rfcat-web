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
export function decodeRetekessTd161(bytes){
 const bits=bitsFromBytes(bytes);
 // One source-derived frame is 36 encoded logical bits plus seven low symbols:
 // 36 * 4 + 28 = 172 base symbols.
 for(let start=0;start+172<=bits.length;start++){
  const logical=decodePulseBits(bits.slice(start,start+144)); if(!logical||logical.length!==36)continue;
  if(bits.slice(start+144,start+172)!=="0".repeat(28))continue;
  const nib=[];for(let i=0;i<36;i+=4)nib.push(valueFromBits(logical.slice(i,i+4),{lsb:true}));
  const [p1,p10,p100,alert,s1,s10,s100,z1,z2]=nib;
  if([p1,p10,p100,s1,s10,s100].some(n=>n>9)||z1!==0||z2!==0||alert>4)continue;
  const pagerId=p100*100+p10*10+p1,systemId=s100*100+s10*10+s1;
  return {fields:{systemId,pagerId,alertType:alert},summary:`TD161 system ${systemId} · pager ${pagerId} · function ${alert}`,bitOffset:start};
 } return null;
}
const protocol={id:"retekess-td161",name:"Retekess TD161",menuGroup:"Restaurant Pagers",description:"Retekess TD161 33-bit OOK pager framing.",decode(bytes){return decodeRetekessTd161(bytes);},
 fields:[{id:"systemId",label:"System ID",type:"number",min:0,max:999,value:0},{id:"pagerId",label:"Pager ID",type:"number",min:0,max:999,value:1},{id:"sequenceEnd",label:"Sequence through pager",type:"number",min:0,max:999,value:1},{id:"allPagers",label:"All pagers",type:"checkbox",value:false},{id:"alertType",label:"Function",type:"number",min:0,max:4,value:0},{id:"frames",label:"Frames",type:"number",min:1,max:30,value:30},...repeatFields(0)],
 encode(v){const e=encodeRetekessTd161(v);return {...e,bits:e.logical,analysis:makeOokAnalysis(e.waveform,5000,"Retekess TD161 OOK",[{name:"Base symbol",symbols:1,requestedUs:200}]),modulation:"ASK/OOK",summary:`Retekess TD161 TX: system ${e.systemId} · pager ${e.pagerId} · function ${e.alertType}`};},
 async configure(d){await configureOok(d,433_920_000,5000);},async transmit(d,e,v){const start=Number(v.pagerId),end=Math.max(start,Number(v.sequenceEnd??start));const targets=v.allPagers?[999]:Array.from({length:end-start+1},(_,i)=>start+i);for(const pagerId of targets){const next=encodeRetekessTd161({...v,pagerId,alertType:v.allPagers?0:v.alertType});await transmitOok(d,next.bytes,v);}}};
export default protocol;
