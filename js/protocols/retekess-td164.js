import { packWaveform, makeOokAnalysis, repeatFields } from "./retekess-common.js";
let sequence=0;
function digits(n){n=Number(n);if(!Number.isInteger(n)||n<0||n>999)throw new Error("Pager ID must be 0–999");return [Math.floor(n/100),Math.floor(n/10)%10,n%10];}
export function encodeRetekessTd164({pagerId,sequenceNumber=sequence,functionCode=1,frames=20}){
 const [h,t,o]=digits(pagerId); const seq=Number(sequenceNumber)&15, fn=Number(functionCode);
 if(![1,2,4].includes(fn))throw new Error("Function must be 1, 2, or 4");
 const c1=(seq+t+(t<6?1:2)+fn)&15,c2=(h+o)&15;
 const hex="aa".repeat(10)+"12340205"+seq.toString(16)+"9"+fn.toString(16)+h.toString(16)+t.toString(16)+o.toString(16)+c1.toString(16)+c2.toString(16)+"00".repeat(5);
 const one=Array.from(hex,ch=>parseInt(ch,16).toString(2).padStart(4,"0")).join("");
 const waveform=one.repeat(Number(frames)); const {bytes,padding}=packWaveform(waveform); sequence=(seq+1)&15;
 return {bytes,waveform,padding,hex,pagerId:Number(pagerId),sequenceNumber:seq,functionCode:fn,checksum1:c1,checksum2:c2,frames:Number(frames)};
}
const protocol={id:"retekess-td164",name:"Retekess TD164",menuGroup:"Restaurant Pagers",description:"Retekess TD164 2-FSK pager framing.",
 fields:[{id:"pagerId",label:"Pager ID",type:"number",min:0,max:999,value:1},{id:"sequenceNumber",label:"Sequence",type:"number",min:0,max:15,value:0},{id:"functionCode",label:"Function",type:"select",value:"1",options:[{value:"1",label:"Page"},{value:"2",label:"Program"},{value:"4",label:"Mute control"}]},{id:"frames",label:"Frames",type:"number",min:1,max:20,value:20},...repeatFields(0)],
 encode(v){const e=encodeRetekessTd164(v);return {...e,bits:e.waveform,analysis:makeOokAnalysis(e.waveform,10000,"Retekess TD164 2-FSK",[{name:"Bit",symbols:1,requestedUs:100}]),modulation:"2-FSK",summary:`Retekess TD164 TX: pager ${e.pagerId} · function ${e.functionCode} · seq ${e.sequenceNumber}`};},
 async configure(d){await d.mode(0x04);await d.setFrequency(433_920_000);await d.setModulation(0x00);await d.setDataRate(10000);await d.setDeviation(15000);await d.setSync(0,0);await d.setManchester(false);await d.setMaxPower();},
 async transmit(d,e,v){await d.setAmpMode(true);try{const r=Math.max(0,Math.trunc(Number(v.repeat??0)));for(let i=0;i<=r;i++)await d.transmit(e.bytes,0,Number(v.offset??0));}finally{await d.setAmpMode(false);}}};
export default protocol;
