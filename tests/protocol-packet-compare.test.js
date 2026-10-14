import test from "node:test";
import assert from "node:assert/strict";
import {compareProtocolPackets} from "../js/rx/protocol-packet-compare.js";
const def={schemaVersion:1,id:"demo",name:"Demo",packetLength:3,sync:"AA",fields:[{name:"counter",start:1,width:1,type:"uint"},{name:"check",start:2,width:1,type:"checksum",algorithm:"xor8",checksumStart:0,checksumEnd:1}]};
test("compares fields and bytes across matched and rejected packets",()=>{
 const result=compareProtocolPackets(def,["AA01AB","AA02A8","BB01BA"]);
 assert.equal(result.total,3);assert.equal(result.matched,2);assert.equal(result.checksumFailures,1);
 assert.equal(result.fields[0].changed,true);
 assert.equal(result.fields[0].values[2],null);
 assert.deepEqual(result.byteDiffs.map(b=>b.changed),[true,true,true]);
 assert.equal(result.rows[2].reason,"sync");
});
test("identical frames do not flag changes",()=>{
 const result=compareProtocolPackets(def,["AA01AB","AA01AB"]);
 assert.ok(result.fields.every(f=>!f.changed));
 assert.ok(result.byteDiffs.every(b=>!b.changed));
});
test("rejects malformed packets and excessive sample sets",()=>{
 assert.throws(()=>compareProtocolPackets(def,["AA01AB"]),/2–24/);
 assert.throws(()=>compareProtocolPackets(def,Array(25).fill("AA01AB")),/2–24/);
 assert.throws(()=>compareProtocolPackets(def,["AA01AB","ZZ"]),/complete hex/);
 assert.throws(()=>compareProtocolPackets(def,["AA01AB","A"]),/complete hex/);
});
