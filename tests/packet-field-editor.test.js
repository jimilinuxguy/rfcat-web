import test from "node:test";
import assert from "node:assert/strict";
import {parsePacketRows,validateFieldAnnotation,fieldValues} from "../js/rx/packet-field-editor.js";

test("packet grid ignores malformed hex and preserves source capture indexes",()=>{
 const rows=parsePacketRows([{hex:"AA 01 FF"},{hex:"oops"},{hex:"AA 02 FF"}]);
 assert.deepEqual(rows.map(row=>row.index),[0,2]);
 assert.deepEqual(rows[0].bytes,["AA","01","FF"]);
});
test("annotations reject overlapping or out-of-bounds ranges",()=>{
 const first=validateFieldAnnotation({start:1,width:2,name:"counter",kind:"counter"},4);
 assert.deepEqual(first,{start:1,width:2,name:"counter",kind:"counter"});
 assert.throws(()=>validateFieldAnnotation({start:2,width:1,name:"flag",kind:"command"},4,[first]),/overlap/);
 assert.throws(()=>validateFieldAnnotation({start:3,width:2,name:"bad",kind:"unknown"},4),/fit/);
 assert.throws(()=>validateFieldAnnotation({start:0,width:1,name:"bad",kind:"unverified"},4),/Unknown/);
});
test("field values compare matching byte offsets",()=>{
 const rows=parsePacketRows([{hex:"AA00FF"},{hex:"AA01FF"}]);
 assert.deepEqual(fieldValues(rows,{start:1,width:1}),[{index:0,value:"00"},{index:1,value:"01"}]);
});
