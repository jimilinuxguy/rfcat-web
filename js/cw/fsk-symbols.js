import {decodeMorseRuns} from "./morse.js";

// Offline FSK discriminator-symbol adapter. No claim that stock CC1111 firmware
// exposes this stream. Unlike OOK, a run of zero symbols is valid FSK space.
export function fskSymbolsToRuns(bytes,{symbolRate,markBit=1,bitCount=bytes?.length*8}={}){
 if(!(bytes instanceof Uint8Array))throw new TypeError("Expected Uint8Array");
 if(!Number.isFinite(symbolRate)||symbolRate<=0||symbolRate>100000)throw new RangeError("Invalid symbol rate");
 if(markBit!==0&&markBit!==1)throw new RangeError("Invalid mark polarity");
 if(!Number.isSafeInteger(bitCount)||bitCount<0||bitCount>bytes.length*8)throw new RangeError("Invalid bit count");
 const runs=[];
 for(let i=0;i<bitCount;i++){
  const bit=(bytes[i>>3]>>(7-(i&7)))&1;
  const level=bit===markBit?1:0;
  if(runs.at(-1)?.level===level)runs.at(-1).durationMs+=1000/symbolRate;
  else runs.push({level,durationMs:1000/symbolRate});
 }
 return runs;
}
export function decodeFskSymbols(bytes,{symbolRate,markBit=1,bitCount,wpm=null}={}){
 const runs=fskSymbolsToRuns(bytes,{symbolRate,markBit,bitCount});
 return {runs,decoded:decodeMorseRuns(runs,{wpm})};
}
