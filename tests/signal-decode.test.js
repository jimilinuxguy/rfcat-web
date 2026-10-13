import test from "node:test";
import assert from "node:assert/strict";
import {decodeHypotheses, compareBitstreams, alignBitstreams} from "../js/rx/signal-decode.js";
test("produces bounded, explicitly unverified encoding hypotheses", () => {
  const result=decodeHypotheses([500,-500,1000,-1000,500,-500],500);
  for(const encoding of ["NRZ","Manchester","Differential Manchester","PWM","PPM"])
    assert.ok(result.candidates.some(c=>c.encoding.startsWith(encoding)),encoding);
  assert.ok(result.candidates.every(c=>c.verified===false&&c.confidence<=85));
});
test("rejects invalid timing and oversized captures",()=>{
  assert.throws(()=>decodeHypotheses([0],500));
  assert.throws(()=>decodeHypotheses([1000],0));
  assert.throws(()=>decodeHypotheses([100000],1,16));
});
test("compares changing positions without inventing missing bits",()=>{
  assert.deepEqual(compareBitstreams(["0101","0111","010"]),{
    comparedBits:3,changingBitIndices:[2],lengths:[4,4,3]
  });
  assert.throws(()=>compareBitstreams(["01","bad"]));
});

test("aligns shifted repeated frames and identifies variable bits",()=>{
 const r=alignBitstreams(["010101010101","10101010101"]);
 assert.equal(r.aligned.length,2);
 assert.ok(r.aligned[1].agreement>=0.9);
 assert.deepEqual(r.changingBitIndices,[]);
});
test("rejects empty alignment input",()=>{
 assert.throws(()=>alignBitstreams(["101",""]));
});
