import {test} from "node:test";
import assert from "node:assert/strict";
import {spectrumSweeps,spectrumDetections,spectrumGrid} from "../js/rx/spectrum-waterfall.js";
test("waterfall aligns complete and partial sweeps without inventing measurements",()=>{
 const frequencies=[433900000,433925000,433950000];
 const samples=[{frequencyHz:frequencies[0],rssiDbm:-110},{frequencyHz:frequencies[1],rssiDbm:-90},{frequencyHz:frequencies[2],rssiDbm:-100},{frequencyHz:frequencies[0],rssiDbm:-80}];
 assert.deepEqual(spectrumSweeps(samples,frequencies),[[-110,-90,-100],[-80,null,null]]);
});
test("duplicate frequencies start another sweep",()=>{
 const hz=[433900000,433925000];
 assert.deepEqual(spectrumSweeps([{frequencyHz:hz[0],rssiDbm:-100},{frequencyHz:hz[0],rssiDbm:-90}],hz),[[-100,null],[-90,null]]);
});
test("baseline detections are ordered by signal rise",()=>{
 const rows=[{frequencyHz:1,deltaDb:8},{frequencyHz:2,deltaDb:null},{frequencyHz:3,deltaDb:4},{frequencyHz:4,deltaDb:20}];
 assert.deepEqual(spectrumDetections(rows,6).map(x=>x.frequencyHz),[4,1]);
});
test("grid matches scan spacing",()=>assert.deepEqual(spectrumGrid(433.87,433.92,25),[433870000,433895000,433920000]));
