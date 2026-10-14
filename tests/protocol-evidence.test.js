import test from "node:test";
import assert from "node:assert/strict";
import {evaluateProtocolEvidence} from "../js/rx/protocol-evidence.js";
const def={schemaVersion:1,id:"demo",name:"Demo",packetLength:3,sync:"AA",fields:[{name:"check",start:2,width:1,type:"checksum",algorithm:"xor8",checksumStart:0,checksumEnd:1}]};
const session=(id,hex)=>({id,name:id,captures:hex.map(hex=>({hex}))});
test("cross-session evidence measures matches and checksum failures",()=>{
 const report=evaluateProtocolEvidence(def,[session("a",["AA01AB","AA02A7","BB01BA"]),session("b",["AA03A9","AA04AE","ZZ"])]);
 assert.equal(report.total,6);assert.equal(report.matched,4);assert.equal(report.coveredSessions,2);
 assert.equal(report.checksumChecks,4);assert.equal(report.checksumPasses,3);
 assert.equal(report.sessions[1].invalid,1);assert.ok(report.warnings.some(w=>w.includes("checksum")));
 assert.ok(report.score>=0&&report.score<=100);
});
test("no data and single-session evidence cannot imply confidence",()=>{
 const empty=evaluateProtocolEvidence(def,[]);
 assert.equal(empty.score,0);assert.equal(empty.label,"insufficient");
 const single=evaluateProtocolEvidence(def,[session("a",Array(40).fill("AA01AB"))]);
 assert.equal(single.label,"insufficient");assert.ok(single.score<100);
});
test("rejects duplicate sessions and excessive session sets",()=>{
 assert.throws(()=>evaluateProtocolEvidence(def,[session("a",[]),session("a",[])]),/distinct/);
 assert.throws(()=>evaluateProtocolEvidence(def,Array.from({length:101},(_,i)=>session(String(i),[]))),/100/);
});
