import test from "node:test";
import assert from "node:assert/strict";
import {analyzeSignalCaptures} from "../js/rx/signal-intelligence.js";

test("groups repeated frames and reports lengths",()=>{
 const r=analyzeSignalCaptures([{hex:"AABB"},{hex:"aabb"},{hex:"AABC"},{hex:"FF"}]);
 assert.equal(r.validCaptures,4);
 assert.equal(r.uniquePayloads,3);
 assert.deepEqual(r.repeatedPayloads,[{hex:"AABB",count:2,indexes:[0,1]}]);
 assert.deepEqual(r.lengths,[{bytes:1,count:1},{bytes:2,count:3}]);
});
test("identifies fixed and variable byte offsets without assigning semantics",()=>{
 const r=analyzeSignalCaptures([{hex:"AA0100"},{hex:"AA0200"},{hex:"AA0300"}]);
 assert.deepEqual(r.fields[0].bytes.map(x=>x.kind),["fixed","variable","fixed"]);
 assert.equal(r.modulation.classification,"unknown");
 assert.deepEqual(r.profiles,[]);
});
test("preserves invalid input indexes and treats decoder labels as unverified",()=>{
 const r=analyzeSignalCaptures([{hex:"0"},{hex:"ZZ"},{hex:"00",protocol:"LRS"},{hex:"01",protocol:"LRS"}]);
 assert.deepEqual(r.invalidIndexes,[0,1]);
 assert.equal(r.profiles[0].confidence,"unverified");
 assert.equal(r.profiles[0].supportingCaptures,2);
});
test("empty captures and malformed capture list",()=>{
 const r=analyzeSignalCaptures([]);
 assert.equal(r.validCaptures,0);
 assert.deepEqual(r.fields,[]);
 assert.throws(()=>analyzeSignalCaptures(null),TypeError);
});

test("candidate counter uses first-seen unique payload order and does not assert identity",()=>{
 const r=analyzeSignalCaptures([0,1,2,3,4].map(n=>({hex:"AA"+n.toString(16).padStart(2,"0")+"FF"})));
 const candidate=r.fields[0].candidates[0];
 assert.equal(candidate.offset,1);
 assert.equal(candidate.label,"candidate counter");
 assert.equal(candidate.confidence,"moderate");
 assert.equal(r.schemaVersion,2);
});
test("small-domain variation is only a low-confidence command hypothesis",()=>{
 const r=analyzeSignalCaptures(["AA00","AB00","AA01","AB01","AA00"].map(hex=>({hex})));
 assert.equal(r.fields[0].candidates[0].label,"candidate command/flag");
 assert.equal(r.fields[0].candidates[0].confidence,"low");
});

test("duplicate frames do not fabricate a counter",()=>{
 const r=analyzeSignalCaptures([{hex:"AA00"},{hex:"AA00"},{hex:"AA01"},{hex:"AA01"}]);
 assert.notEqual(r.fields[0].candidates[0].label,"candidate counter");
});
test("byte counter wraparound is treated as a candidate, not verified",()=>{
 const r=analyzeSignalCaptures(["AAFD","AAFE","AAFF","AA00","AA01"].map(hex=>({hex})));
 assert.equal(r.fields[0].candidates[0].label,"candidate counter");
 assert.equal(r.fields[0].candidates[0].confidence,"moderate");
});
test("mixed lengths never share field inference cohorts",()=>{
 const r=analyzeSignalCaptures(["AA00","AA01","AA0000","AA0001"].map(hex=>({hex})));
 assert.equal(r.fields.length,2);
 assert.deepEqual(r.fields.map(f=>f.length),[2,3]);
});
