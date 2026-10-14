import {analyzeSignalCaptures} from "../rx/signal-intelligence.js";
import {FIELD_KINDS,parsePacketRows,validateFieldAnnotation,fieldValues} from "../rx/packet-field-editor.js";
import {inferFieldCandidates} from "../rx/advanced-field-inference.js";
import {listCaptureSessions,getCaptureSession,saveCaptureSession} from "../storage/capture-session-store.js";

export function initSignalIntelligence(){
 const host=document.querySelector("#signal-analyzer-panel");
 if(!host)return;
 const panel=document.createElement("details");
 panel.id="signal-intelligence";panel.className="card collapsible";
 panel.innerHTML=`<summary class="section-summary"><span>Signal Intelligence · offline fingerprinting</span><span class="summary-note">No radio access</span></summary>
 <div class="section-body"><p>Compare demodulated packets in a saved Capture Library session. No modulation or protocol identity is assumed.</p>
 <div class="actions"><label>Capture session <select id="intelligence-session"><option value="">Select a saved session</option></select></label><button id="intelligence-refresh" type="button">Refresh sessions</button><button id="intelligence-analyze" type="button">Analyze packets</button><button id="intelligence-export" type="button" disabled>Export JSON</button><button id="intelligence-save" type="button" disabled>Attach report to session</button></div>
 <section id="packet-field-editor" aria-label="Packet field editor" hidden><h3>Packet field editor · experimental</h3><p>Select a byte in the packet grid to set the field start. Compare same-length captures; annotations are hypotheses, not verified decoding.</p><div class="actions"><label>Frame length <select id="field-cohort"></select></label><label>Field start <input id="field-start" type="number" min="0" value="0"></label><label>Width (bytes) <input id="field-width" type="number" min="1" value="1"></label><label>Field name <input id="field-name" maxlength="40" value="field1"></label><label>Interpretation <select id="field-kind"></select></label><button id="field-add" type="button">Add annotation</button><button id="field-export" type="button">Export annotations</button></div><div id="field-packet-grid" style="overflow-x:auto"></div><div id="field-annotations" aria-live="polite"></div><h4>Advanced field inference · tentative</h4><p>Counter ordering, changing bit masks, and simple trailing checksums are hypotheses, not protocol identification. Verify with independent captures.</p><div id="field-inference" aria-live="polite"></div><p id="field-status" role="status"></p></section><p id="intelligence-status" role="status">Select a session to begin.</p><div id="intelligence-results" aria-live="polite"></div></div>`;
 host.after(panel);
 const el=id=>panel.querySelector("#"+id);
 let report=null,source=null,sourceFingerprint=null;
 let annotations={};
 const fieldKind=el("field-kind");FIELD_KINDS.forEach(kind=>fieldKind.add(new Option(kind,kind)));
 const cohort=el("field-cohort");
 function cohortRows(){return parsePacketRows(source?.captures).filter(row=>row.bytes.length===Number(cohort.value));}
 function currentAnnotations(){return annotations[cohort.value]||[];}
 function drawEditor(){
  const rows=cohortRows(),fields=currentAnnotations(),grid=el("field-packet-grid");grid.replaceChildren();el("field-inference").replaceChildren();
  if(!rows.length)return;
  const table=document.createElement("table");table.setAttribute("aria-label","Packet byte comparison");
  const header=document.createElement("tr");for(const name of ["Capture",...rows[0].bytes.map((_,i)=>"Byte "+i)]){const th=document.createElement("th");th.textContent=name;header.append(th);}table.append(header);
  rows.slice(0,30).forEach(row=>{const tr=document.createElement("tr");const id=document.createElement("th");id.textContent="#"+row.index;tr.append(id);row.bytes.forEach((value,i)=>{const td=document.createElement("td");const button=document.createElement("button");button.type="button";button.textContent=value;button.title="Select byte "+i;button.setAttribute("aria-label","Capture "+row.index+" byte "+i+": "+value);button.style.fontFamily="monospace";if(rows.some(other=>other.bytes[i]!==value))button.style.fontWeight="bold";if(fields.some(field=>i>=field.start&&i<field.start+field.width))button.style.textDecoration="underline";button.addEventListener("click",()=>{el("field-start").value=String(i);el("field-status").textContent="Selected byte "+i;});td.append(button);tr.append(td);});table.append(tr);});grid.append(table);
  const suggestions=inferFieldCandidates(rows);const inference=el("field-inference");if(!suggestions.length){const p=document.createElement("p");p.textContent="No supported candidates (at least three matching-length packets required).";inference.append(p);}else{const list=document.createElement("ul");for(const suggestion of suggestions){const li=document.createElement("li");li.textContent="Bytes "+suggestion.start+"–"+(suggestion.start+suggestion.width-1)+" · "+suggestion.kind+" · "+suggestion.confidence+" ("+suggestion.score+"): "+suggestion.evidence;list.append(li);}inference.append(list);}
  const output=el("field-annotations");output.replaceChildren();for(const field of fields){const p=document.createElement("p");const values=fieldValues(rows,field);p.textContent=field.name+" · "+field.kind+" · bytes "+field.start+"–"+(field.start+field.width-1)+" · values: "+[...new Set(values.map(v=>v.value))].slice(0,8).join(", ");const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";remove.addEventListener("click",()=>{annotations[cohort.value]=currentAnnotations().filter(f=>f!==field);drawEditor();});p.append(" ",remove);output.append(p);}
 }
 cohort.addEventListener("change",drawEditor);
 el("field-add").addEventListener("click",()=>{try{const rows=cohortRows();if(!rows.length)throw Error("Choose a frame length.");const field=validateFieldAnnotation({start:el("field-start").value,width:el("field-width").value,name:el("field-name").value,kind:fieldKind.value},rows[0].bytes.length,currentAnnotations());annotations[cohort.value]=[...currentAnnotations(),field];drawEditor();el("field-status").textContent="Annotation added. Attach report to persist."; }catch(error){el("field-status").textContent=error.message;}});
 el("field-export").addEventListener("click",()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:1,type:"rfcat-field-annotations",annotations},null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="rfcat-field-annotations.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 async function refresh(){
  const previous=el("intelligence-session").value;
  const sessions=await listCaptureSessions();
  el("intelligence-session").replaceChildren(new Option("Select a saved session",""),...sessions.map(s=>new Option(s.name||s.id,s.id)));
  if(sessions.some(s=>s.id===previous))el("intelligence-session").value=previous;
 }
 function reset(){report=null;source=null;sourceFingerprint=null;annotations={};el("packet-field-editor").hidden=true;el("intelligence-export").disabled=true;el("intelligence-save").disabled=true;el("intelligence-results").replaceChildren();}
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
   annotations=structuredClone(source.fieldAnnotations||{});
   const sizes=[...new Set(parsePacketRows(source.captures).map(row=>row.bytes.length))].sort((a,b)=>a-b);
   cohort.replaceChildren(...sizes.map(n=>new Option(n+" bytes",String(n))));
   el("packet-field-editor").hidden=!sizes.length;drawEditor();
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
   for(const field of report.fields){
    if(!field.candidates?.length)continue;
    const heading=document.createElement("h4");heading.textContent=field.length+"-byte cohort · field candidates";results.append(heading);
    const list=document.createElement("ul");list.className="intelligence-candidates";
    for(const candidate of field.candidates){
     const item=document.createElement("li");
     item.textContent="Byte "+candidate.offset+" · "+candidate.label+" · "+candidate.confidence+" confidence (score "+candidate.score+"): "+candidate.evidence;
     list.append(item);
    }
    results.append(list);
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
   await saveCaptureSession({...latest,intelligence:structuredClone(report),fieldAnnotations:structuredClone(annotations)});
   el("intelligence-status").textContent="Intelligence report attached to the capture session.";
  }catch(error){el("intelligence-status").textContent="Save failed: "+error.message;}
 });
 refresh().catch(error=>{el("intelligence-status").textContent="Unable to load sessions: "+error.message;});
}
