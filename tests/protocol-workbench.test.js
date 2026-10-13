import test from "node:test";
import assert from "node:assert/strict";
import {inspectField,defineProtocol,inspectProtocol,inferVariableRuns,checksumCandidates} from "../js/rx/protocol-workbench.js";
test("bit inspector handles MSB and LSB order without precision loss",()=>{
 assert.equal(inspectField("10010000",0,8).hex,"0x90");
 assert.equal(inspectField("10010000",0,8,{endianness:"lsb"}).hex,"0x09");
 assert.equal(inspectField("1".repeat(64),0,64).decimal,"18446744073709551615");
});
test("protocol definition rejects overlaps and duplicates",()=>{
 const f={name:"address",start:0,length:8,endianness:"msb"};
 assert.throws(()=>defineProtocol({name:"Test",bitLength:16,fields:[f,{...f,name:"counter",start:7}]}),/Overlapping/);
 assert.throws(()=>defineProtocol({name:"Test",bitLength:16,fields:[f,f]}),/duplicate/);
 const d=defineProtocol({name:"Test",bitLength:16,fields:[f]});
 assert.equal(inspectProtocol(d,"1010101000000000")[0].hex,"0xAA");
 assert.throws(()=>inspectProtocol(d,"1010"),/length/);
});
test("variable bit regions are bounded and do not imply semantic fields",()=>{
 const r=inferVariableRuns(["000011110000","000010110100","000011110100"]);
 assert.deepEqual(r.variableRuns.map(v=>[v.start,v.length]),[[5,1],[9,1]]);
 assert.equal(r.stableBits,10);
 assert.throws(()=>inferVariableRuns(["010","01"]),/Align/);
});
test("checksum hints are explicitly unverified",()=>{
 const r=checksumCandidates([1,2,3]);
 assert.equal(r[0].matches,true);assert.equal(r[1].matches,true);
 assert.ok(r.every(c=>c.verified===false));
});
