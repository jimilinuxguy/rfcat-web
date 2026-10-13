// International Morse timing and offline pulse decoding. Durations are milliseconds.
export const MORSE=Object.freeze({
 A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..",
 0:"-----",1:".----",2:"..---",3:"...--",4:"....-",5:".....",6:"-....",7:"--...",8:"---..",9:"----.",".":".-.-.-",",":"--..--","?":"..--..","/":"-..-.","=":"-...-","+":".-.-.","-":"-....-"
});
const REVERSE=Object.freeze(Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k])));
export function normalizeMessage(value){
 if(typeof value!=="string")throw new TypeError("Message must be text");
 const text=value.toUpperCase().trim().replace(/\s+/g," ");
 if(!text||text.length>120)throw new Error("Enter 1–120 characters");
 for(const ch of text)if(ch!==" "&&!MORSE[ch])throw new Error("Unsupported Morse character: "+ch);
 return text;
}
export function morseTiming(wpm){
 if(!Number.isInteger(wpm)||wpm<5||wpm>40)throw new Error("Keying rate must be 5–40 WPM");
 return 1200/wpm;
}
export function encodeMorse(message,wpm=20){
 const text=normalizeMessage(message),unitMs=morseTiming(wpm),runs=[];
 const append=(level,units)=>{
  const last=runs.at(-1);
  if(last&&last.level===level)last.units+=units;
  else runs.push({level,units});
 };
 const words=text.split(" ");
 words.forEach((word,wi)=>{
  if(wi)append(0,7);
  [...word].forEach((ch,ci)=>{
   if(ci)append(0,3);
   [...MORSE[ch]].forEach((mark,mi)=>{
    if(mi)append(0,1);
    append(1,mark==="."?1:3);
   });
  });
 });
 return {text,wpm,unitMs,code:words.map(w=>[...w].map(c=>MORSE[c]).join(" ")).join(" / "),runs:runs.map(r=>({...r,durationMs:r.units*unitMs})),durationMs:runs.reduce((s,r)=>s+r.units*unitMs,0)};
}
export function decodeMorseRuns(runs,{wpm=null,tolerance=0.45}={}){
 if(!Array.isArray(runs)||runs.length===0)return {text:"",code:"",wpm:null,unitMs:null,confidence:0,marks:0};
 if(runs.length>10000)throw new Error("Too many pulse runs");
 if(!Number.isFinite(tolerance)||tolerance<0.1||tolerance>0.8)throw new Error("Invalid tolerance");
 const clean=[];
 for(const run of runs){
  if((run.level!==0&&run.level!==1)||!Number.isFinite(run.durationMs)||run.durationMs<=0)throw new Error("Invalid pulse run");
  if(clean.at(-1)?.level===run.level)clean.at(-1).durationMs+=run.durationMs;
  else clean.push({level:run.level,durationMs:run.durationMs});
 }
 const marks=clean.filter(r=>r.level===1);
 if(!marks.length)return {text:"",code:"",wpm:null,unitMs:null,confidence:0,marks:0};
 const unitMs=wpm==null?estimateUnit(clean):morseTiming(wpm);
 const classify=(duration,values)=>values.map(n=>({n,error:Math.abs(duration/unitMs-n)/n})).sort((a,b)=>a.error-b.error)[0];
 let current="",text="",code="",total=0,good=0;
 const flush=()=>{if(!current)return;text+=REVERSE[current]??"�";code+=(code.endsWith("/")?"":" ")+current;current="";};
 for(const run of clean){
  if(run.level===1){
   const v=classify(run.durationMs,[1,3]);total++;if(v.error<=tolerance)good++;
   current+=v.n===1?".":"-";
  }else if(current){
   const v=classify(run.durationMs,[1,3,7]);total++;if(v.error<=tolerance)good++;
   if(v.n===7){flush();if(text&&!text.endsWith(" ")){text+=" ";code+=" /";}}
   else if(v.n===3)flush();
  }
 }
 flush();
 return {text:text.trim(),code:code.trim(),wpm:Math.round(1200/unitMs*10)/10,unitMs,confidence:total?good/total:0,marks:marks.length};
}
export function estimateUnit(runs){
 const durations=runs.filter(r=>r.level===1).map(r=>r.durationMs).sort((a,b)=>a-b);
 if(!durations.length)throw new Error("No key-down pulses");
 // Lower quartile favors dots, but all-dash traffic is inherently ambiguous.
 return durations[Math.floor((durations.length-1)*0.25)];
}
export function packOokRuns(runs,{sampleRate=1000,maxBytes=255}={}){
 if(!Number.isInteger(sampleRate)||sampleRate<500||sampleRate>5000)throw new Error("Sample rate must be 500–5000 symbols/s");
 const bits=[];
 for(const run of runs){
  const count=Math.round(run.durationMs*sampleRate/1000);
  if(count<1)throw new Error("Pulse shorter than one symbol");
  if(bits.length+count>maxBytes*8)throw new Error("Waveform exceeds CC1111 255-byte packet capacity; shorten message or increase WPM");
  for(let i=0;i<count;i++)bits.push(run.level);
 }
 // Pad with carrier off, preserving the intended message and avoiding stray key-down.
 while(bits.length%8)bits.push(0);
 const bytes=new Uint8Array(bits.length/8);
 for(let i=0;i<bits.length;i++)bytes[i>>3]|=bits[i]<<(7-(i&7));
 return {bytes,bitCount:bits.length,sampleRate,durationMs:bits.length*1000/sampleRate};
}
export function runsFromRawBytes(bytes,sampleRate){
 if(!(bytes instanceof Uint8Array)||!Number.isFinite(sampleRate)||sampleRate<=0)throw new Error("Invalid raw RX input");
 const runs=[];
 for(const b of bytes)for(let shift=7;shift>=0;shift--){
  const level=(b>>shift)&1,last=runs.at(-1);
  if(last?.level===level)last.durationMs+=1000/sampleRate;
  else runs.push({level,durationMs:1000/sampleRate});
 }
 return runs;
}
