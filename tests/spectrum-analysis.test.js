import {test} from "node:test";
import assert from "node:assert/strict";
import {summarizeSpectrum,compareSpectrum,spectrumCsv} from "../js/rx/spectrum-analysis.js";
test("average and peak RSSI summarize repeated frequencies",()=>{
 const summary=summarizeSpectrum([{frequencyHz:433920000,rssiDbm:-110,timestamp:1},{frequencyHz:433920000,rssiDbm:-90,timestamp:2},{frequencyHz:433895000,rssiDbm:-115,timestamp:3}]);
 assert.deepEqual(summary.map(s=>s.frequencyHz),[433895000,433920000]);
 assert.equal(summary[1].averageDbm,-100);assert.equal(summary[1].peakDbm,-90);assert.equal(summary[1].count,2);
});
test("baseline comparison reports average RSSI rise and handles missing frequencies",()=>{
 const signal=summarizeSpectrum([{frequencyHz:433920000,rssiDbm:-92},{frequencyHz:433945000,rssiDbm:-93}]);
 const baseline=summarizeSpectrum([{frequencyHz:433920000,rssiDbm:-113}]);
 const rows=compareSpectrum(signal,baseline);
 assert.equal(rows[0].deltaDb,21);assert.equal(rows[1].deltaDb,null);
});
test("CSV includes settings, baseline and raw measurements",()=>{
 const samples=[{frequencyHz:433920000,rssiDbm:-92,timestamp:123}];
 const csv=spectrumCsv(samples,{passes:20},summarizeSpectrum([{frequencyHz:433920000,rssiDbm:-113}]));
 assert.match(csv,/# passes: 20/);assert.match(csv,/baseline_dbm,delta_db/);assert.match(csv,/433920000,1,-92,-92,-92,-113,21/);assert.match(csv,/433920000,-92,123/);
});
