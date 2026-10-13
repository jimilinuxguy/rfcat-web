import test from "node:test";
import assert from "node:assert/strict";
import {createCapturePipeline} from "../js/rx/capture-pipeline.js";
test("groups identical bursts within time window and preserves timestamps",()=>{
 const p=createCapturePipeline({windowMs:100});
 const a=p.ingest({bytes:[0xaa,0x55],timestampMs:1000,frequencyHz:433920000,rssi:-60});
 const b=p.ingest({bytes:[0xaa,0x55],timestampMs:1050,frequencyHz:433920000,rssi:-55});
 assert.equal(a.duplicate,false);assert.equal(b.duplicate,true);
 assert.equal(p.snapshot().groups[0].count,2);
 assert.equal(p.snapshot().groups[0].rssiMax,-55);
 p.ingest({bytes:[0xaa,0x55],timestampMs:1200,frequencyHz:433920000});
 assert.equal(p.snapshot().groups.length,2);
});
test("rejects malformed and out-of-order events",()=>{
 const p=createCapturePipeline();
 assert.throws(()=>p.ingest({bytes:[256],timestampMs:0}),/byte/);
 p.ingest({bytes:[1],timestampMs:10});
 assert.throws(()=>p.ingest({bytes:[1],timestampMs:9}),/ordered/);
});
test("bounded retention and clear",()=>{
 const p=createCapturePipeline({maxEvents:2});
 for(let i=0;i<3;i++)p.ingest({bytes:[i],timestampMs:i});
 assert.equal(p.snapshot().totalEvents,2);
 p.clear();assert.equal(p.snapshot().groups.length,0);
});
