import test from "node:test";
import assert from "node:assert/strict";
import {normalizeInvestigation} from "../js/storage/investigation-store.js";
import {RFCAT_DB_VERSION,RFCAT_DB_STORES} from "../js/storage/db.js";
test("M21 versioned investigation metadata is normalized without embedding captures",()=>{
 const result=normalizeInvestigation({id:"test_1",name:"  Test  ",sessionId:"capture1",definitionId:"proto1",stage:"timeline"});
 assert.equal(result.schemaVersion,1);assert.equal(result.name,"Test");assert.equal(result.stage,"timeline");
 assert.equal(result.sessionId,"capture1");assert.equal(result.definitionId,"proto1");
 assert.equal(result.captures,undefined);
 assert.ok(RFCAT_DB_VERSION>=7);assert.ok(RFCAT_DB_STORES.includes("protocol-investigations"));
});
test("invalid investigations and stages are handled",()=>{
 assert.throws(()=>normalizeInvestigation({id:"",name:"X"}),/ID/);
 assert.throws(()=>normalizeInvestigation({id:"ok",name:""}),/name/);
 assert.throws(()=>normalizeInvestigation({id:"ok",name:"X",sessionId:{id:"x"}}),/reference/);
 assert.equal(normalizeInvestigation({id:"ok",name:"X",stage:"unknown"}).stage,"captures");
});
