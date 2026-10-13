import test from "node:test";
import assert from "node:assert/strict";
import {waveformWindow,cursorTimeFromX,cursorXFromTime} from "../js/rx/waveform-cursors.js";
test("waveform window maps zoom and pan into absolute microseconds",()=>{
 assert.deepEqual(waveformWindow(10000,2,0.5),{visible:5000,offset:2500});
 assert.deepEqual(waveformWindow(10000,1,1),{visible:10000,offset:0});
});
test("cursor dragging maps CSS-scaled canvas coordinates and clamps",()=>{
 assert.equal(cursorTimeFromX(480,960,10000,2,0.5),5000);
 assert.equal(cursorTimeFromX(-100,960,10000,2,0.5),2500);
 assert.equal(cursorTimeFromX(2000,960,10000,2,0.5),7500);
 assert.equal(cursorXFromTime(5000,960,10000,2,0.5),480);
});
test("cursor helpers reject invalid geometry",()=>{
 assert.throws(()=>cursorTimeFromX(10,0,1000,1,0));
 assert.throws(()=>waveformWindow(0,1,0));
});
