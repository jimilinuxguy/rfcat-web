import test from "node:test";
import assert from "node:assert/strict";
import {inferProtocolStateMachine} from "../js/rx/protocol-state-machine.js";
const def={schemaVersion:1,id:"states",name:"States",packetLength:3,sync:"AA",fields:[{name:"mode",start:1,width:1,type:"enum",values:{"1":"Idle","2":"Active"}},{name:"check",start:2,width:1,type:"checksum",algorithm:"xor8",checksumStart:0,checksumEnd:1}]};
test("finds recurring state transitions, dwell runs, and labels",()=>{
 const report=inferProtocolStateMachine(def,["AA01AB","AA01AB","AA02A8","AA01AB","AA02A8"]);
 assert.equal(report.fieldName,"mode");assert.equal(report.used,5);assert.equal(report.states.length,2);
 assert.equal(report.transitions.find(e=>e.from==="1"&&e.to==="2").count,2);
 assert.equal(report.recurring.length,1);assert.equal(report.runs[0].count,2);
});
test("excludes checksum failures by default, optionally includes them",()=>{
 const samples=["AA01AB","AA02FF","AA01AB"];
 const safe=inferProtocolStateMachine(def,samples);
 assert.equal(safe.used,2);assert.equal(safe.excluded,1);
 assert.ok(safe.warnings.some(w=>w.includes("checksum")));
 const all=inferProtocolStateMachine(def,samples,{includeInvalidChecksums:true});
 assert.equal(all.used,3);
});
test("rejects unknown fields and warns about counter-like state candidates",()=>{
 assert.throws(()=>inferProtocolStateMachine(def,["AA01AB","AA02A8"],{fieldName:"missing"}),/Unknown state field/);
 const report=inferProtocolStateMachine(def,["AA01AB","AA02A8","AA03A9"]);
 assert.equal(report.states.length,3);
});
