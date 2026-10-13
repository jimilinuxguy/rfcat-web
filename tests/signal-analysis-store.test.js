import test from "node:test";
import assert from "node:assert/strict";
import {validateSignalCapture} from "../js/storage/signal-analysis-store.js";
test("signal store validates signed integer pulse captures",()=>{
 assert.deepEqual(validateSignalCapture({durationsUs:[500,-500]}).durationsUs,[500,-500]);
 for(const durationsUs of [[],[0],[NaN],[Infinity],[1.5],["500"]]){
  assert.throws(()=>validateSignalCapture({durationsUs}),/Invalid/);
 }
 assert.throws(()=>validateSignalCapture({durationsUs:new Array(250001).fill(500)}),/Invalid/);
});
