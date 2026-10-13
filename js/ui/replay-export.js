import {buildReplayReport,replayReportCSV,replayReportJSON} from "../rx/replay-report.js";
// Browser-only download adapter, isolated from app's capture and RF controllers.
export function installReplayExport({host,getFrames,getComparison,getSummary,onEmpty}){
 const controls=document.createElement("div");
 controls.innerHTML='<button type="button" id="replay-export-json">Export replay JSON</button> <button type="button" id="replay-export-csv">Export replay CSV</button>';
 host.append(controls);
 function download(format){
  const frames=getFrames();
  if(!frames.length){onEmpty();return;}
  const report=buildReplayReport(frames,getSummary(frames),getComparison());
  const csv=format==="csv";
  const blob=new Blob([csv?replayReportCSV(report):replayReportJSON(report)],{type:csv?"text/csv;charset=utf-8":"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="rfcat-replay-report."+format;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 controls.querySelector("#replay-export-json").onclick=()=>download("json");
 controls.querySelector("#replay-export-csv").onclick=()=>download("csv");
 return controls;
}
