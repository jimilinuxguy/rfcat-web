import test from "node:test";
import assert from "node:assert/strict";
import {parsePacketRows} from "../js/rx/packet-field-editor.js";
import {inferFieldCandidates} from "../js/rx/advanced-field-inference.js";
const rows=hex=>parsePacketRows(hex.map(hex=>({hex})));
test("detects little-endian rollover in multi-byte counter",()=>{
 const candidates=inferFieldCandidates(rows(["A0FE00F0","A0FF00F0","A00001F0","A00101F0","A00201F0"]));
 assert.ok(candidates.some(c=>c.kind==="counter"&&c.start===1&&c.width===2&&c.endian==="little"&&c.step===1));
});
test("detects big-endian two-byte counters",()=>{
 const candidates=inferFieldCandidates(rows(["AA00FECC","AA00FFCC","AA0100CC","AA0101CC"]));
 assert.ok(candidates.some(c=>c.kind==="counter"&&c.start===1&&c.width===2&&c.endian==="big"));
});
test("reports bit masks without claiming semantic meaning",()=>{
 const candidates=inferFieldCandidates(rows(["A000FF","A001FF","A003FF","A002FF"]));
 assert.ok(candidates.some(c=>c.kind==="bit-mask"&&c.start===1&&c.mask==="0x03"));
});
test("detects XOR trailing checksum with varying payloads",()=>{
 const packets=[1,2,4,8,16].map(n=>[0xA5,n,0xA5^n].map(b=>b.toString(16).padStart(2,"0")).join(""));
 const candidates=inferFieldCandidates(rows(packets));
 assert.ok(candidates.some(c=>c.kind==="checksum"&&c.algorithm==="xor8"&&c.start===2));
});
test("rejects unsupported, mixed-length, and constant checksum samples",()=>{
 assert.deepEqual(inferFieldCandidates(rows(["AA01","AA02"])),[]);
 assert.deepEqual(inferFieldCandidates(rows(["AA01","AA02","AA0300"])),[]);
 assert.ok(!inferFieldCandidates(rows(["AA01FF","AA02FF","AA03FF"])).some(c=>c.kind==="checksum"));
});
test("candidate limit and scoring are bounded",()=>{
 const candidates=inferFieldCandidates(rows(["A000FF","A001FE","A002FD","A003FC"]),{maxCandidates:2});
 assert.ok(candidates.length<=2);
 assert.ok(candidates.every(c=>c.score>=0&&c.score<=1&&["low","medium","high"].includes(c.confidence)));
});
