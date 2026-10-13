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

test("different payload or frequency creates distinct consecutive groups",()=>{
 const p=createCapturePipeline({windowMs:500});
 p.ingest({bytes:[1],timestampMs:100,frequencyHz:433920000});
 p.ingest({bytes:[2],timestampMs:101,frequencyHz:433920000});
 p.ingest({bytes:[1],timestampMs:102,frequencyHz:433920000});
 p.ingest({bytes:[1],timestampMs:103,frequencyHz:315000000});
 assert.equal(p.snapshot().groups.length,4);
 assert.equal(p.snapshot().duplicateEvents,0);
});
test("grouping never mutates caller payload or snapshot state",()=>{
 const p=createCapturePipeline();
 const bytes=new Uint8Array([0xaa,0x55]);
 p.ingest({bytes,timestampMs:1});
 bytes[0]=0;
 const s=p.snapshot();
 s.events[0].hex="tampered";s.groups[0].count=99;
 assert.equal(p.snapshot().events[0].hex,"aa55");
 assert.equal(p.snapshot().groups[0].count,1);
});
test("rejects invalid pipeline options and malformed metadata",()=>{
 assert.throws(()=>createCapturePipeline({windowMs:-1}),/limits/);
 const p=createCapturePipeline();
 assert.throws(()=>p.ingest({bytes:[1],timestampMs:-1}),/timestamp/);
 assert.throws(()=>p.ingest({bytes:[1],timestampMs:1,frequencyHz:0}),/frequency/);
 assert.throws(()=>p.ingest({bytes:[1],timestampMs:1,rssi:NaN}),/RSSI/);
});
