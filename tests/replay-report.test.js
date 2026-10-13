import {test} from "node:test";
import assert from "node:assert/strict";
import {buildReplayReport,replayReportCSV,replayReportJSON} from "../js/rx/replay-report.js";
const frames=[{index:0,hex:"AABB",bytes:[170,187],timestampMs:0,rssi:-42,decoder:"raw"},{index:1,hex:"01",bytes:[1],timestampMs:null,rssi:null,decoder:null}];
test("report contains capture metadata, summary and full comparison",()=>{
 const report=buildReplayReport(frames,{count:2},{sessionId:"abc",sessionName:'quoted, "name"',rows:[{hex:"AABB",left:1,right:2,delta:1}]});
 assert.equal(report.schemaVersion,1);
 assert.equal(report.captures[0].timestamp,"1970-01-01T00:00:00.000Z");
 assert.equal(report.captures[1].timestamp,null);
 assert.equal(report.comparison.rows[0].delta,1);
 assert.equal(JSON.parse(replayReportJSON(report)).comparison.sessionName,'quoted, "name"');
 assert.match(replayReportCSV(report),/comparison/);
 assert.match(replayReportCSV(report),/"AABB"/);
});
test("CSV quotes fields and includes capture rows without comparison",()=>{
 const report=buildReplayReport(frames,{count:2});
 assert.equal(report.comparison,null);
 const csv=replayReportCSV(report);
 assert.equal(csv.split("\r\n").filter(Boolean).length,3);
 assert.match(csv,/"capture","1","AABB"/);
});
