import test from "node:test";
import assert from "node:assert/strict";
import {prepareReplay,replaySummary,replayAt} from "../js/rx/session-replay.js";

test("offline replay preserves order, bytes and timestamps",()=>{
 const frames=prepareReplay([{bytes:[0,255],timestamp:"2026-01-01T00:00:00Z"},{bytes:[0,255],timestamp:"2026-01-01T00:00:01Z"},{bytes:[1,2,3],timestamp:null}]);
 assert.equal(frames[0].hex,"00FF");
 assert.equal(frames[1].timestampMs-frames[0].timestampMs,1000);
 assert.deepEqual(replaySummary(frames),{count:3,uniquePayloads:2,duplicates:1,totalBytes:7,minBytes:2,maxBytes:3,firstTimestampMs:Date.parse("2026-01-01T00:00:00Z"),lastTimestampMs:Date.parse("2026-01-01T00:00:01Z")});
 assert.equal(replayAt(frames,2).hex,"010203");
 assert.equal(replayAt(frames,3),null);
});
test("replay rejects malformed or oversized captures",()=>{
 assert.throws(()=>prepareReplay([{bytes:[256]}]),/invalid bytes/i);
 assert.throws(()=>prepareReplay([{bytes:[]}]),/Invalid capture length/);
 assert.throws(()=>prepareReplay([{bytes:new Array(4097).fill(0)}]),/Invalid capture length/);
 assert.throws(()=>prepareReplay(new Array(10001).fill({bytes:[1]})),/Invalid capture count/);
});
test("replay accepts Uint8Array and hexadecimal exports",()=>{
 assert.equal(prepareReplay([{bytes:new Uint8Array([0xab,0xcd])}])[0].hex,"ABCD");
 assert.equal(prepareReplay([{bytes:"AB CD EF"}])[0].hex,"ABCDEF");
});
