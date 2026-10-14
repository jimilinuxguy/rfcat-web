import test from "node:test";
import assert from "node:assert/strict";
import {normalizeRegressionSuite,runProtocolRegression,appendRegressionFixture} from "../js/rx/protocol-regression.js";
import {importProtocolRegressionSuite} from "../js/storage/protocol-regression-store.js";
const definition={schemaVersion:1,id:"fixture_demo",name:"Demo",packetLength:3,sync:"AA",fields:[{name:"counter",start:1,width:1,type:"uint"},{name:"check",start:2,width:1,type:"checksum",algorithm:"xor8",checksumStart:0,checksumEnd:1}]};
const fixtures={schemaVersion:1,protocolId:"fixture_demo",fixtures:[{id:"good",hex:"AA01AB",expectMatch:true,expectChecksumValid:true,expectedFields:{counter:1}},{id:"bad-prefix",hex:"BB01BA",expectMatch:false},{id:"bad-checksum",hex:"AA01FF",expectMatch:true,expectChecksumValid:false}]};
test("passes positive, negative, field and checksum regression fixtures",()=>{
 const result=runProtocolRegression(definition,fixtures);
 assert.equal(result.passed,3);assert.equal(result.failed,0);assert.equal(result.total,3);
 assert.deepEqual(fixtures.fixtures[0].expectedFields,{counter:1});
});
test("detects changed sync, wrong field values and checksum regressions",()=>{
 const changed={...definition,sync:"BB"};
 const result=runProtocolRegression(changed,fixtures);
 assert.ok(result.failed>=2);
 const mismatch=runProtocolRegression(definition,{...fixtures,fixtures:[{...fixtures.fixtures[0],expectedFields:{counter:99}}]});
 assert.equal(mismatch.failed,1);assert.match(mismatch.cases[0].failures[0],/counter/);
});
test("validates suite identity, duplicate IDs, malicious inputs and mismatched protocol",()=>{
 assert.throws(()=>normalizeRegressionSuite({...fixtures,fixtures:[fixtures.fixtures[0],fixtures.fixtures[0]]}),/unique/);
 assert.throws(()=>normalizeRegressionSuite({...fixtures,fixtures:[{id:"x",hex:"ZZ",expectMatch:true}]}),/hex/);
 assert.throws(()=>normalizeRegressionSuite({...fixtures,fixtures:[{id:"x",hex:"AA",expectMatch:false,expectedFields:{counter:1}}]}),/matching/);
 assert.throws(()=>runProtocolRegression({...definition,id:"other"},fixtures),/different protocol/);
 assert.throws(()=>importProtocolRegressionSuite("{"),/JSON/);
 assert.equal(appendRegressionFixture({...fixtures,fixtures:[]},fixtures.fixtures[0]).fixtures.length,1);
});
