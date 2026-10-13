import test from "node:test";
import assert from "node:assert/strict";
import {timingHistogram,compareAlignedCaptures,pulseRange} from "../js/rx/signal-workbench.js";
test("histograms separate high and low intervals and preserve indices",()=>{
 const histogram=timingHistogram([500,-500,510,-1500,500,-510],{maxBins:4});
 assert.equal(histogram.high.reduce((sum,b)=>sum+b.count,0),3);
 assert.equal(histogram.low.reduce((sum,b)=>sum+b.count,0),3);
 assert.deepEqual(histogram.high.flatMap(b=>b.indices).sort((a,b)=>a-b),[0,2,4]);
});
test("histogram handles uniform durations and rejects invalid samples",()=>{
 const hist=timingHistogram([500,500,-500]);
 assert.equal(hist.high[0].count,2);
 assert.throws(()=>timingHistogram([0]));
 assert.throws(()=>timingHistogram([]));
});
test("frame comparison identifies stable and changing pulse positions",()=>{
 const comparison=compareAlignedCaptures([[500,-500,1000],[500,-1500,1000],[500,-500,1000]]);
 assert.equal(comparison.framesCompared,3);
 assert.equal(comparison.stableCount,2);
 assert.deepEqual(comparison.positions.filter(p=>!p.stable).map(p=>p.index),[1]);
 assert.throws(()=>compareAlignedCaptures([[500]]));
});
test("selected histogram indices map to absolute time bounds",()=>{
 assert.deepEqual(pulseRange([500,-1000,500,-2000],[1,3]),{startUs:500,endUs:4000});
 assert.equal(pulseRange([500],[]),null);
});
