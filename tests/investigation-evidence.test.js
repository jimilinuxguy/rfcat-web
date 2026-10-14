import test from "node:test";
import assert from "node:assert/strict";
import {createInvestigationEvidence} from "../js/rx/investigation-evidence.js";

const packet=(value)=>({bytes:new Uint8Array([value]),fields:{value}});
test("starts at a new boundary and excludes earlier packets",()=>{
 const evidence=createInvestigationEvidence();
 assert.equal(evidence.add(packet(1)),false);
 evidence.start();evidence.add(packet(2));
 assert.equal(evidence.snapshot().captures[0].hex,"02");
 evidence.start();
 assert.deepEqual(evidence.snapshot().captures,[]);
});
test("snapshots do not alias live packet objects",()=>{
 const evidence=createInvestigationEvidence();
 const source=packet(3);
 evidence.start();evidence.add(source);
 source.bytes[0]=9;source.fields.value=9;
 const first=evidence.snapshot();
 assert.deepEqual(first.captures,[{hex:"03",fields:{value:3}}]);
 first.captures[0].fields.value=10;
 assert.equal(evidence.snapshot().captures[0].fields.value,3);
});
test("bounded evidence tracks drops and ignores packets after stop",()=>{
 const evidence=createInvestigationEvidence({limit:1});
 evidence.start();evidence.add(packet(1));evidence.add(packet(2));evidence.stop();evidence.add(packet(3));
 assert.deepEqual(evidence.snapshot(),{captures:[{hex:"01",fields:{value:1}}],dropped:1});
});
test("invalid packets and limits are rejected",()=>{
 assert.throws(()=>createInvestigationEvidence({limit:0}),RangeError);
 const evidence=createInvestigationEvidence();evidence.start();
 assert.throws(()=>evidence.add({bytes:[1]}),TypeError);
});
