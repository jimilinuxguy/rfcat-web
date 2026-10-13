import test from "node:test";
import assert from "node:assert/strict";
import {replayDelays,compareReplaySessions} from "../js/rx/replay-analysis.js";
test("replay timing handles timestamps, missing values and speed",()=>{
 const frames=[{timestampMs:100},{timestampMs:600},{timestampMs:null},{timestampMs:10000}];
 assert.deepEqual(replayDelays(frames,{speed:2,maxGapMs:3000,fallbackGapMs:200}),[0,250,100,100]);
 assert.throws(()=>replayDelays(frames,{speed:0}),/speed/i);
 assert.deepEqual(replayDelays([{timestampMs:100},{timestampMs:100000}],{maxGapMs:1000}),[0,1000]);
});
test("cross-session comparison counts identical payloads",()=>{
 const diff=compareReplaySessions([{hex:"AA"},{hex:"AA"},{hex:"BB"}],[{hex:"AA"},{hex:"CC"}]);
 assert.deepEqual(diff,[{hex:"AA",left:2,right:1,delta:-1},{hex:"BB",left:1,right:0,delta:-1},{hex:"CC",left:0,right:1,delta:1}]);
});
