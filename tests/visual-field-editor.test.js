import test from "node:test";
import assert from "node:assert/strict";
import {parseFieldDraft,addFieldDraft,replaceFieldDraft,removeFieldDraft,frameByteMap} from "../js/ui/visual-field-editor.js";
test("visual field draft adds, updates, removes and maps byte assignments",()=>{
 const first=addFieldDraft([],{name:"device",start:1,width:2,type:"hex"},5);
 const second=addFieldDraft(first,{name:"counter",start:3,width:1,type:"uint"},5);
 assert.deepEqual(frameByteMap(second,5).map(b=>b.field),[null,"device","device","counter",null]);
 const changed=replaceFieldDraft(second,1,{name:"counter",start:4,width:1,type:"uint"},5);
 assert.equal(changed[1].start,4);
 assert.deepEqual(removeFieldDraft(changed,0).map(f=>f.name),["counter"]);
 assert.deepEqual(first,[{name:"device",start:1,width:2,type:"hex"}]);
});
test("visual editor rejects invalid fields and overlapping offsets",()=>{
 const fields=[{name:"device",start:0,width:2,type:"hex"}];
 assert.throws(()=>addFieldDraft(fields,{name:"overlap",start:1,width:1,type:"hex"},3),/overlap/);
 assert.throws(()=>replaceFieldDraft(fields,2,{name:"missing",start:2,width:1,type:"hex"},3),/Select a field/);
 assert.throws(()=>addFieldDraft(fields,{name:"bad",start:2,width:2,type:"hex"},3),/width/);
 assert.throws(()=>frameByteMap([{name:"a",start:0,width:2},{name:"b",start:1,width:1}],3),/overlapping/);
 assert.throws(()=>parseFieldDraft("{}"),/array/);
});
