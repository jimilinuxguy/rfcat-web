import test from "node:test";
import assert from "node:assert/strict";
import {inspectBytes,inspectRows,inspectBits,inspectSelection,inspectFields,inspectComparison,inspectAnnotation,inspectReport,inspectBitRange,overlappingFields} from "../js/rx/packet-inspector.js";
test("hex, ASCII, rows and bit order are consistent",()=>{
 const b=inspectBytes({hex:"41017F"});
 assert.equal(inspectRows(b,8)[0].ascii,"A..");
 assert.deepEqual(inspectBits(b,"msb"),["01000001","00000001","01111111"]);
 assert.deepEqual(inspectBits(b,"lsb"),["10000010","10000000","11111110"]);
 assert.equal(inspectSelection(b,1,2).hex,"01 7F");
});
test("invalid data and selections are rejected",()=>{
 for(const hex of ["A","GG","0xAB"])assert.throws(()=>inspectBytes(hex));
 assert.throws(()=>inspectSelection(inspectBytes("AB"),1,1));
 assert.throws(()=>inspectRows(inspectBytes("AB"),7));
});
test("comparison identifies changed bits and lengths",()=>{
 const result=inspectComparison("AABB","AABC00");
 assert.deepEqual(result.pairs[0].changedBytes,[1,2]);
 assert.deepEqual(result.regions[1].changedBits,[2,1,0]);
});
test("fields map exact ranges and unmatched packets",()=>{
 const def={schemaVersion:1,id:"sample",name:"Sample",packetLength:2,sync:"",fields:[{name:"Header",start:0,width:1,type:"hex"},{name:"Flag",start:1,width:1,type:"bits",bitOffset:2,bitWidth:3}]};
 const matched=inspectFields(inspectBytes("AABB"),def);
 assert.equal(matched.fields[1].startBit,10);
 assert.equal(matched.fields[1].widthBits,3);
 assert.equal(inspectFields(inspectBytes("AA"),def).matched,false);
});
test("annotations and report do not mutate packet",()=>{
 const packet={hex:"4142",timestamp:"now"},before=JSON.stringify(packet);
 const annotation=inspectAnnotation(inspectBytes(packet),{start:0,width:1,label:"Header"});
 assert.equal(inspectReport(packet,[annotation]).observed.hex,"41 42");
 assert.equal(JSON.stringify(packet),before);
 assert.throws(()=>inspectAnnotation(inspectBytes(packet),{start:2,width:1,label:"bad"}));
});

test("canonical bit ranges and overlapping field mapping",()=>{
 const bytes=inspectBytes("A5F0");
 assert.deepEqual(inspectBitRange(bytes,4,8),{startBit:4,bitLength:8,startByte:0,endByte:1,binary:"01011111",hex:"0x5F"});
 const fields=[{name:"first",startBit:0,widthBits:8},{name:"second",startBit:6,widthBits:4},{name:"third",startBit:12,widthBits:4}];
 assert.deepEqual(overlappingFields(fields,7,2).map(f=>f.name),["first","second"]);
 assert.throws(()=>inspectBitRange(bytes,15,2));
 assert.throws(()=>inspectBitRange(bytes,0,0));
});
test("live capture bytes are copied before inspection",()=>{
 const capture={bytes:new Uint8Array([0xAA,0xBB])};
 const bytes=inspectBytes(capture);
 bytes[0]=0;
 assert.equal(capture.bytes[0],0xAA);
 assert.equal(inspectReport(capture).observed.hex,"AA BB");
});
