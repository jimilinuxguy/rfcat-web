import test from "node:test";
import assert from "node:assert/strict";
import {encodeMorse} from "../js/cw/morse.js";
import {fskSymbolsToRuns,decodeFskSymbols} from "../js/cw/fsk-symbols.js";

function fixture(message,wpm,rate,markBit=1){
 const {runs}=encodeMorse(message,wpm);
 const bits=[];
 for(const run of runs){
  for(let n=0;n<Math.round(run.durationMs*rate/1000);n++)bits.push(run.level?markBit:1-markBit);
 }
 const bytes=new Uint8Array(Math.ceil(bits.length/8));
 bits.forEach((bit,i)=>bytes[i>>3]|=bit<<(7-i%8));
 return {bytes,bitCount:bits.length};
}
for(const wpm of [5,20,30]){
 test(`offline FSK Morse SOS at ${wpm} WPM`,()=>{
  const f=fixture("SOS",wpm,1000);
  assert.equal(decodeFskSymbols(f.bytes,{symbolRate:1000,bitCount:f.bitCount,wpm}).decoded.text,"SOS");
 });
}
test("inverted mark polarity",()=>{
 const f=fixture("A",20,1000,0);
 assert.equal(decodeFskSymbols(f.bytes,{symbolRate:1000,bitCount:f.bitCount,markBit:0,wpm:20}).decoded.text,"A");
});
test("all-zero FSK frame is valid space, not idle",()=>{
 const runs=fskSymbolsToRuns(new Uint8Array(32),{symbolRate:1000});
 assert.equal(runs.length,1);
 assert.equal(runs[0].level,0);
 assert.equal(runs[0].durationMs,256);
});
test("invalid rate, polarity and length rejected",()=>{
 assert.throws(()=>fskSymbolsToRuns(new Uint8Array(1),{symbolRate:0}));
 assert.throws(()=>fskSymbolsToRuns(new Uint8Array(1),{symbolRate:1000,markBit:2}));
 assert.throws(()=>fskSymbolsToRuns(new Uint8Array(1),{symbolRate:1000,bitCount:9}));
});
