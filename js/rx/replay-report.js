// Pure, deterministic offline replay reporting. No DOM, storage or radio dependencies.
export function buildReplayReport(frames, summary, comparison = null) {
 const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  summary: {...summary},
  captures: frames.map(f => ({index:f.index,hex:f.hex,byteLength:f.bytes.length,timestamp:f.timestampMs===null?null:new Date(f.timestampMs).toISOString(),rssi:f.rssi,decoder:f.decoder})),
  comparison: comparison ? {sessionId:comparison.sessionId,sessionName:comparison.sessionName,rows:comparison.rows.map(r=>({...r}))} : null
 };
 return report;
}
const csvCell=value => '"'+String(value??"").replace(/"/g,'""')+'"';
export function replayReportCSV(report) {
 const lines=[["section","index","hex","byteLength","timestamp","rssi","decoder","currentCount","selectedCount","delta"].map(csvCell).join(",")];
 for(const f of report.captures)lines.push(["capture",f.index+1,f.hex,f.byteLength,f.timestamp,f.rssi,f.decoder,"","",""].map(csvCell).join(","));
 for(const r of report.comparison?.rows??[])lines.push(["comparison","",r.hex,"","","","",r.left,r.right,r.delta].map(csvCell).join(","));
 return lines.join("\r\n")+"\r\n";
}
export function replayReportJSON(report) {return JSON.stringify(report,null,2)+"\n";}
