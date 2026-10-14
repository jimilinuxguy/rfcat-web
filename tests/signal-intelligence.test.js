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
