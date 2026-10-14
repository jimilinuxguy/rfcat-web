import {inferProtocolStateMachine} from "../rx/protocol-state-machine.js";
import {listCaptureSessions,getCaptureSession} from "../storage/capture-session-store.js";
export function initProtocolStateMachine(panel,{getDefinition,setStatus}){
 const section=document.createElement("section");section.id="pd-state-machine";
 section.innerHTML=`<h4>Protocol State Machine Inference</h4><p>Infer candidate states and transitions from decoded captures. State semantics are unverified; counter fields can produce misleading graphs.</p>
 <div class="actions"><label>Capture session <select id="pd-sm-session"></select></label><label>State field <select id="pd-sm-field"><option value="">Auto (prefer enum)</option></select></label><label><input type="checkbox" id="pd-sm-invalid"> Include invalid-checksum frames</label><button type="button" id="pd-sm-refresh">Refresh</button><button type="button" id="pd-sm-run">Infer states</button><button type="button" id="pd-sm-export">Export JSON</button></div>
 <p id="pd-sm-summary" role="status"></p><div id="pd-sm-results" style="overflow-x:auto"></div>`;
 panel.querySelector("#pd-output").before(section);
 const el=id=>section.querySelector("#"+id);let report=null;
 async function refresh(){const selected=el("pd-sm-session").value;const sessions=await listCaptureSessions();el("pd-sm-session").replaceChildren(new Option("Select capture session",""),...sessions.map(s=>new Option(s.name+" ("+s.captures.length+")",s.id)));if(sessions.some(s=>s.id===selected))el("pd-sm-session").value=selected;}
 function fields(){const selected=el("pd-sm-field").value;const draft=getDefinition();el("pd-sm-field").replaceChildren(new Option("Auto (prefer enum)",""),...(draft.fields??[]).filter(f=>f.type!=="checksum").map(f=>new Option(f.name+" ("+f.type+")",f.name)));if([...el("pd-sm-field").options].some(o=>o.value===selected))el("pd-sm-field").value=selected;}
 el("pd-sm-refresh").addEventListener("click",()=>{try{fields();refresh().catch(e=>setStatus(e.message));}catch(e){setStatus(e.message);}});
 el("pd-sm-run").addEventListener("click",async()=>{try{
  const session=await getCaptureSession(el("pd-sm-session").value);if(!session)throw Error("Select a capture session");
  report=inferProtocolStateMachine(getDefinition(),session.captures,{fieldName:el("pd-sm-field").value||null,includeInvalidChecksums:el("pd-sm-invalid").checked});
  const root=el("pd-sm-results");root.replaceChildren();
  function table(id,headers,rows){const table=document.createElement("table");table.id=id;const head=document.createElement("tr");for(const h of headers){const th=document.createElement("th");th.textContent=h;head.append(th);}table.append(head);for(const values of rows){const tr=document.createElement("tr");for(const value of values){const td=document.createElement("td");td.textContent=String(value);tr.append(td);}table.append(tr);}root.append(table);}
  table("pd-sm-states",["State","Label","Observations","First capture"],report.states.map(s=>[s.id,s.label,s.count,s.firstIndex]));
  table("pd-sm-transitions",["From","To","Count","Recurring"],report.transitions.map(t=>[t.from,t.to,t.count,t.from!==t.to&&t.count>=2?"Yes":"No"]));
  table("pd-sm-runs",["State","Start","End","Captures"],report.runs.map(r=>[r.state,r.start,r.end,r.count]));
  const warnings=document.createElement("p");warnings.id="pd-sm-warnings";warnings.textContent=report.warnings.join(" · ");root.append(warnings);
  el("pd-sm-summary").textContent=report.used+" usable captures · "+report.states.length+" candidate states · "+report.transitions.length+" transition types · "+report.recurring.length+" recurring non-self transitions.";
  setStatus("State machine inference ready.");
 }catch(e){report=null;el("pd-sm-results").replaceChildren();el("pd-sm-summary").textContent="";setStatus(e.message);}});
 el("pd-sm-export").addEventListener("click",()=>{if(!report){setStatus("Infer states before exporting.");return;}const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=report.protocolId+"-states.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 refresh().catch(e=>setStatus(e.message));return {refresh};
}
