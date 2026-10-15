import {decodeMorseRuns} from "./morse.js";

// Offline-only continuous bitstream assembler. The caller must supply an
// actual discriminator-symbol stream and its clock; stock RFCat NIC_RECV
// packets have NOT been validated as such a stream.
export function createFskRunStream({symbolRate,markBit=1,wpm=20,onMessage=()=>{}}={}){
 if(!Number.isFinite(symbolRate)||symbolRate<=0||symbolRate>100000)throw new RangeError("Invalid symbol rate");
 if(markBit!==0&&markBit!==1)throw new RangeError("Invalid mark polarity");
 let runs=[],frames=0,symbols=0;
 function append(level,count){
  if(!count)return;
  const durationMs=count*1000/symbolRate;
  if(runs.at(-1)?.level===level)runs.at(-1).durationMs+=durationMs;
  else runs.push({level,durationMs});
 }
 function flush(){
  const candidate=runs.filter(r=>r.durationMs>0);
  runs=[];
  if(!candidate.some(r=>r.level===1))return null;
  const result=decodeMorseRuns(candidate,{wpm});
  onMessage(result);
  return result;
 }
 return {
  push(bytes,{bitCount=bytes?.length*8}={}){
   if(!(bytes instanceof Uint8Array))throw new TypeError("Expected Uint8Array");
   if(!Number.isSafeInteger(bitCount)||bitCount<0||bitCount>bytes.length*8)throw new RangeError("Invalid bit count");
   frames++;
   for(let i=0;i<bitCount;i++){
    const level=(((bytes[i>>3]>>(7-i%8))&1)===markBit)?1:0;
    append(level,1);
   }
   symbols+=bitCount;
   // Deliberately never infer an idle frame from all-zero bytes.
   return {frames,symbols,runs:runs.length};
  },
  flush,
  reset(){runs=[];frames=0;symbols=0;},
  status(){return {frames,symbols,runs:runs.length};}
 };
}
