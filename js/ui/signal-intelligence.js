import {analyzeSignalCaptures} from "../rx/signal-intelligence.js";
import {listCaptureSessions,getCaptureSession,saveCaptureSession} from "../storage/capture-session-store.js";

export function initSignalIntelligence(){
 const host=document.querySelector("#signal-analyzer-panel");
 if(!host)return;
 const panel=document.createElement("details");
 panel.id="signal-intelligence";panel.className="card collapsible";
 panel.innerHTML=`<summary class="section-summary"><span>Signal Intelligence · offline fingerprinting</span><span class="summary-note">No radio access</span></summary>
 <div class="section-body"><p>Compare demodulated packets in a saved Capture Library session. No modulation or protocol identity is assumed.</p>
 <div class="actions"><label>Capture session <select id="intelligence-session"><option value="">Select a saved session</option></select></label><button id="intelligence-refresh" type="button">Refresh sessions</button><button id="intelligence-analyze" type="button">Analyze packets</button><button id="intelligence-export" type="button" disabled>Export JSON</button><button id="intelligence-save" type="button" disabled>Attach report to session</button></div>
 <p id="intelligence-status" role="status">Select a session to begin.</p><div id="intelligence-results" aria-live="polite"></div></div>`;
 host.append(panel);
 const el=id=>panel.querySelector("#"+id);
 let report=null,source=null,sourceFingerprint=null;
 async function refresh(){
  const previous=el("intelligence-session").value;
  const sessions=await listCaptureSessions();
  el("intelligence-session").replaceChildren(new Option("Select a saved session",""),...sessions.map(s=>new Option(s.name||s.id,s.id)));
  if(sessions.some(s=>s.id===previous))el("intelligence-session").value=previous;
 }
 function reset(){report=null;source=null;sourceFingerprint=null;el("intelligence-export").disabled=true;el("intelligence-save").disabled=true;el("intelligence-results").replaceChildren();}
 el("intelligence-session").addEventListener("change",reset);
 el("intelligence-refresh").addEventListener("click",()=>refresh().catch(error=>{el("intelligence-status").textContent=error.message;}));
 el("intelligence-analyze").addEventListener("click",async()=>{
  reset();
  try{
   const id=el("intelligence-session").value;
   if(!id)throw Error("Select a capture session.");
   source=await getCaptureSession(id);
   if(!source)throw Error("Session not found. Refresh the list.");
   report=analyzeSignalCaptures(source.captures||[]);
   sourceFingerprint=JSON.stringify((source.captures||[]).map(c=>({hex:c?.hex,protocol:c?.protocol})));
   const results=el("intelligence-results");
   const title=document.createElement("p");
   title.textContent=`${report.validCaptures} valid / ${report.totalCaptures} captures · ${report.uniquePayloads} unique payloads · ${report.repeatedPayloads.length} repeated payloads`;
   results.append(title);
   const lengths=document.createElement("p");lengths.textContent="Packet lengths (bytes): "+(report.lengths.map(l=>l.bytes+" × "+l.count).join(", ")||"none");results.append(lengths);
   const summary=document.createElement("p");summary.textContent="Modulation: unknown. Decoder labels are unverified; variable bytes are not proven counters or checksums.";results.append(summary);
   for(const field of report.fields){
    const line=document.createElement("p");
    line.textContent=field.length+"-byte frames: fixed offsets "+field.bytes.filter(b=>b.kind==="fixed").map(b=>b.offset).join(", ")+"; variable offsets "+field.bytes.filter(b=>b.kind==="variable").map(b=>b.offset).join(", ");
    results.append(line);
   }
   for(const profile of report.profiles){const p=document.createElement("p");p.textContent="Decoder label: "+profile.name+" ("+profile.supportingCaptures+" captures; unverified)";results.append(p);}
   el("intelligence-export").disabled=false;el("intelligence-save").disabled=false;
   el("intelligence-status").textContent="Offline analysis complete. Review evidence before attaching.";
  }catch(error){el("intelligence-status").textContent="Analysis failed: "+error.message;}
 });
 el("intelligence-export").addEventListener("click",()=>{
  if(!report)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="rfcat-signal-intelligence.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 el("intelligence-save").addEventListener("click",async()=>{
  if(!report||!source)return;
  try{
   const latest=await getCaptureSession(source.id);
   if(!latest)throw Error("Session was deleted.");
   const latestFingerprint=JSON.stringify((latest.captures||[]).map(c=>({hex:c?.hex,protocol:c?.protocol})));
   if(latestFingerprint!==sourceFingerprint)throw Error("Session captures changed; analyze again before saving.");
   await saveCaptureSession({...latest,intelligence:structuredClone(report)});
   el("intelligence-status").textContent="Intelligence report attached to the capture session.";
  }catch(error){el("intelligence-status").textContent="Save failed: "+error.message;}
 });
 refresh().catch(error=>{el("intelligence-status").textContent="Unable to load sessions: "+error.message;});
}
