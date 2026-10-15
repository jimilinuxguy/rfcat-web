import test from "node:test";
import assert from "node:assert/strict";
import {encodeMorse} from "../js/cw/morse.js";
import {createFskRunStream} from "../js/cw/fsk-run-stream.js";

function fixture(message,wpm,rate){
 const bits=[];
 for(const r of encodeMorse(message,wpm).runs)
  for(let n=0;n<Math.round(r.durationMs*rate/1000);n++)bits.push(r.level);
 return bits;
}
function pack(bits){
 const bytes=new Uint8Array(Math.ceil(bits.length/8));
 bits.forEach((b,i)=>bytes[i>>3]|=b<<(7-i%8));
 return bytes;
}
test("FSK stream retains timing across arbitrary byte-aligned packet splits",()=>{
 const bits=fixture("SOS",20,1000),bytes=pack(bits),rx=createFskRunStream({symbolRate:1000,wpm:20});
 for(let i=0;i<bytes.length;i+=17)rx.push(bytes.subarray(i,i+17),{bitCount:Math.min(17,bytes.length-i)*8});
 assert.equal(rx.flush().text,"SOS");
});
test("FSK stream preserves long all-zero spaces across frames",()=>{
 const rx=createFskRunStream({symbolRate:1000,wpm:20});
 rx.push(new Uint8Array([0xff]));
 rx.push(new Uint8Array(60));
 rx.push(new Uint8Array([0xff]));
 assert.equal(rx.flush().text,"E E");
});
test("FSK stream rejects malformed frames",()=>{
 const rx=createFskRunStream({symbolRate:1000});
 assert.throws(()=>rx.push(new Uint8Array(1),{bitCount:9}));
 assert.throws(()=>rx.push([0]));
});
