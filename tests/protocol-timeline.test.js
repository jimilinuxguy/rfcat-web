import test from "node:test";
import assert from "node:assert/strict";
import {analyzeProtocolTimeline} from "../js/rx/protocol-timeline.js";
const def={schemaVersion:1,id:"timeline",name:"Timeline",packetLength:3,sync:"AA",fields:[{name:"counter",start:1,width:1,type:"uint"},{name:"check",start:2,width:1,type:"checksum",algorithm:"xor8",checksumStart:0,checksumEnd:1}]};
test("detects increment candidates, repeats, and checksum failures in capture order",()=>{
 const report=analyzeProtocolTimeline(def,[{hex:"AA01AB",timestamp:"2026-01-01T00:00:00Z"},{hex:"AA02A8"},{hex:"AA03FF"},{hex:"AA03FF"},{hex:"BB04BE"}]);
 assert.equal(report.total,5);assert.equal(report.matched,4);assert.equal(report.checksumFailures,2);assert.equal(report.repetitions.length,1);assert.equal(report.hasTimestamps,true);
 assert.equal(report.fields[0].transitions.length,2);assert.equal(report.fields[0].incrementing,false);assert.equal(report.fields[0].classification,"changing");
 assert.equal(report.events[4].reason,"sync");
});
test("detects strictly sequential increments and stable fields",()=>{
 const report=analyzeProtocolTimeline(def,["AA01AB","AA02A8","AA03A9"]);
 assert.equal(report.fields[0].incrementing,true);
 assert.equal(report.fields[0].classification,"sequential increment candidate");
 assert.equal(report.hasTimestamps,false);
});
test("invalid hex is recorded without aborting session and limits are enforced",()=>{
 const report=analyzeProtocolTimeline(def,["GG","AA01AB"]);
 assert.equal(report.events[0].reason,"invalid hex");
 assert.equal(report.matched,1);
 assert.throws(()=>analyzeProtocolTimeline(def,["AA01AB"]),/2–500/);
 assert.throws(()=>analyzeProtocolTimeline(def,Array(501).fill("AA01AB")),/2–500/);
});
