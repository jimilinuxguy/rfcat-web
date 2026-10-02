import { bitsOf, packWaveform, pulseEncode, makeOokAnalysis, configureOok, transmitOok, repeatFields } from "./retekess-common.js";
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
const protocol={id:"retekess-td161",name:"Retekess TD161",menuGroup:"Restaurant Pagers",description:"Retekess TD161 33-bit OOK pager framing.",
 fields:[{id:"systemId",label:"System ID",type:"number",min:0,max:999,value:0},{id:"pagerId",label:"Pager ID",type:"number",min:0,max:999,value:1},{id:"sequenceEnd",label:"Sequence through pager",type:"number",min:0,max:999,value:1},{id:"allPagers",label:"All pagers",type:"checkbox",value:false},{id:"alertType",label:"Function",type:"number",min:0,max:4,value:0},{id:"frames",label:"Frames",type:"number",min:1,max:30,value:30},...repeatFields(0)],
 encode(v){const e=encodeRetekessTd161(v);return {...e,bits:e.logical,analysis:makeOokAnalysis(e.waveform,5000,"Retekess TD161 OOK",[{name:"Base symbol",symbols:1,requestedUs:200}]),modulation:"ASK/OOK",summary:`Retekess TD161 TX: system ${e.systemId} · pager ${e.pagerId} · function ${e.alertType}`};},
 async configure(d){await configureOok(d,433_920_000,5000);},async transmit(d,e,v){const start=Number(v.pagerId),end=Math.max(start,Number(v.sequenceEnd??start));const targets=v.allPagers?[999]:Array.from({length:end-start+1},(_,i)=>start+i);for(const pagerId of targets){const next=encodeRetekessTd161({...v,pagerId,alertType:v.allPagers?0:v.alertType});await transmitOok(d,next.bytes,v);}}};
export default protocol;
