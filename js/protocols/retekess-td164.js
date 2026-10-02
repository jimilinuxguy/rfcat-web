import { packWaveform, makeOokAnalysis, repeatFields, bitsFromBytes } from "./retekess-common.js";
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
export function decodeRetekessTd164(bytes){
 const bits=bitsFromBytes(bytes), marker="10101010".repeat(10)+"00010010001101000000001000000101";
 for(let start=0;start+marker.length+36<=bits.length;start++){
  if(bits.slice(start,start+marker.length)!==marker)continue;
  const tail=bits.slice(start+marker.length,start+marker.length+36), n=[];for(let i=0;i<tail.length;i+=4)n.push(parseInt(tail.slice(i,i+4),2));
  const [seq,sep,fn,h,t,o,c1,c2,z]=n;if(sep!==9||z!==0||h>9||t>9||o>9)continue;
  const expected1=(seq+t+(t<6?1:2)+fn)&15,expected2=(h+o)&15;if(c1!==expected1||c2!==expected2)continue;
  const pagerId=h*100+t*10+o;return {fields:{pagerId,sequence:seq,function:fn,checksum1:c1,checksum2:c2},summary:`TD164 pager ${pagerId} · function ${fn} · seq ${seq}`,bitOffset:start};
 } return null;
}
const protocol={id:"retekess-td164",name:"Retekess TD164",menuGroup:"Restaurant Pagers",description:"Retekess TD164 2-FSK pager framing.",rxPreset:{frequency:433_920_000,dataRate:10000,bandwidth:93_750,modulation:0x00,deviation:15000,syncWord:0x0000,syncMode:0,manchester:false,lengthMode:"fixed",packetLength:255,crc:false,whitening:false,appendStatus:false,addressCheck:0,deviceAddress:0,lowball:false},decode(bytes){return decodeRetekessTd164(bytes);},
 fields:[{id:"pagerId",label:"Pager ID",type:"number",min:0,max:999,value:1},{id:"sequenceEnd",label:"Sequence through pager",type:"number",min:0,max:999,value:1},{id:"sequenceNumber",label:"Sequence",type:"number",min:0,max:15,value:0},{id:"functionCode",label:"Function",type:"select",value:"1",options:[{value:"1",label:"Page"},{value:"2",label:"Program"},{value:"4",label:"Mute control"}]},{id:"frames",label:"Frames",type:"number",min:1,max:20,value:20},...repeatFields(0)],
 encode(v){const e=encodeRetekessTd164(v);return {...e,bits:e.waveform,analysis:makeOokAnalysis(e.waveform,10000,"Retekess TD164 2-FSK",[{name:"Bit",symbols:1,requestedUs:100}]),modulation:"2-FSK",summary:`Retekess TD164 TX: pager ${e.pagerId} · function ${e.functionCode} · seq ${e.sequenceNumber}`};},
 async configure(d){await d.mode(0x04);await d.setFrequency(433_920_000);await d.setModulation(0x00);await d.setDataRate(10000);await d.setDeviation(15000);await d.setSync(0,0);await d.setManchester(false);await d.setMaxPower();},
 async transmit(d,e,v){await d.setAmpMode(true);try{const start=Number(v.pagerId),end=Math.max(start,Number(v.sequenceEnd??start)),r=Math.max(0,Math.trunc(Number(v.repeat??0)));for(let pagerId=start;pagerId<=end;pagerId++){const next=encodeRetekessTd164({...v,pagerId});for(let i=0;i<=r;i++)await d.transmit(next.bytes,0,Number(v.offset??0));}}finally{await d.setAmpMode(false);}}};
export default protocol;
