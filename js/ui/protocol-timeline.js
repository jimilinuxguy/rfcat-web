import {analyzeProtocolTimeline} from "../rx/protocol-timeline.js";
import {getCaptureSession,listCaptureSessions} from "../storage/capture-session-store.js";
export function initProtocolTimeline(panel,{getDefinition,setStatus}){
 const section=document.createElement("section");section.id="pd-timeline";
 section.innerHTML=`<h4>Protocol Timeline Analysis</h4><p>Track decoded fields in capture order. Counter and state labels are hypotheses, not proof. Missing timestamps retain capture order.</p>
 <div class="actions"><label>Capture session <select id="pd-tl-session"></select></label><button type="button" id="pd-tl-refresh">Refresh sessions</button><button type="button" id="pd-tl-run">Analyze timeline</button><button type="button" id="pd-tl-export">Export timeline JSON</button></div>
 <p id="pd-tl-summary" role="status"></p><div id="pd-tl-results" style="overflow-x:auto"></div>`;
 panel.querySelector("#pd-output").before(section);
 const el=id=>section.querySelector("#"+id);let report=null;
 async function refresh(){const selected=el("pd-tl-session").value;const sessions=await listCaptureSessions();el("pd-tl-session").replaceChildren(new Option("Select capture session",""),...sessions.map(s=>new Option(s.name+" ("+s.captures.length+")",s.id)));if(sessions.some(s=>s.id===selected))el("pd-tl-session").value=selected;}
 el("pd-tl-refresh").addEventListener("click",()=>refresh().catch(e=>setStatus(e.message)));
 el("pd-tl-run").addEventListener("click",async()=>{try{
  const session=await getCaptureSession(el("pd-tl-session").value);if(!session)throw Error("Select a capture session");
  if(session.captures.length>500)throw Error("Session exceeds 500 captures; narrow the session before analysis");
  report=analyzeProtocolTimeline(getDefinition(),session.captures);
  const root=el("pd-tl-results");root.replaceChildren();
  const table=document.createElement("table");table.id="pd-tl-table";
  const header=document.createElement("tr");for(const value of ["Field","Classification","Unique values","Transitions","Sequence"]){const th=document.createElement("th");th.textContent=value;header.append(th);}table.append(header);
  for(const field of report.fields){const tr=document.createElement("tr");for(const value of [field.name,field.classification,field.uniqueValues,field.transitions.length,field.observations.map(o=>o.index+":"+String(o.label??o.value)).join(" → ")]){const td=document.createElement("td");td.textContent=String(value);tr.append(td);}table.append(tr);}
  root.append(table);
  const eventTable=document.createElement("table");eventTable.id="pd-tl-events";
  const head=document.createElement("tr");for(const value of ["Capture","Timestamp","Match","Checksum","Packet"]){const th=document.createElement("th");th.textContent=value;head.append(th);}eventTable.append(head);
  for(const event of report.events){const tr=document.createElement("tr");for(const value of [event.index,event.time===null?"—":new Date(event.time).toISOString(),event.matched?"Yes":event.reason,event.checksumsValid===null?"N/A":event.checksumsValid?"Valid":"Invalid",event.hex??"Invalid hex"]){const td=document.createElement("td");td.textContent=String(value);tr.append(td);}eventTable.append(tr);}root.append(eventTable);
  el("pd-tl-summary").textContent=report.matched+"/"+report.total+" matched · "+report.fields.filter(f=>f.incrementing).length+" sequential increment candidates · "+report.repetitions.length+" adjacent repeated packets · "+report.checksumFailures+" checksum failures.";
  setStatus("Timeline analysis ready.");
 }catch(e){report=null;el("pd-tl-results").replaceChildren();el("pd-tl-summary").textContent="";setStatus(e.message);}});
 el("pd-tl-export").addEventListener("click",()=>{if(!report){setStatus("Analyze a session before exporting.");return;}const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=report.protocolId+"-timeline.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 refresh().catch(e=>setStatus(e.message));return {refresh};
}
