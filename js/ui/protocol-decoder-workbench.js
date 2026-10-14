import {compareProtocolPackets} from "../rx/protocol-packet-compare.js";
import {getCaptureSession,listCaptureSessions} from "../storage/capture-session-store.js";

export function initProtocolDecoderWorkbench(panel,{getDefinition,setStatus}){
 const section=document.createElement("section");section.id="pd-workbench";
 section.innerHTML=`<h4>Protocol Decoder Workbench</h4><p>Compare 2–24 captured packets side by side. Changed bytes and decoded fields are highlighted. Nothing is transmitted or saved.</p>
 <div class="actions"><label>Capture session <select id="pd-wb-session"></select></label><button type="button" id="pd-wb-refresh">Refresh sessions</button><button type="button" id="pd-wb-load">Load session packets</button><button type="button" id="pd-wb-compare">Compare packets</button><button type="button" id="pd-wb-export">Export comparison JSON</button></div>
 <label>Packet hex, one per line (or session-loaded values) <textarea id="pd-wb-packets" rows="6" spellcheck="false" placeholder="AA01AB&#10;AA02A8"></textarea></label>
 <p id="pd-wb-summary" role="status"></p><div id="pd-wb-results" style="overflow-x:auto"></div>`;
 panel.querySelector("#pd-output").before(section);
 const el=id=>section.querySelector("#"+id);
 let lastReport=null;
 async function refresh(){const selected=el("pd-wb-session").value;const sessions=await listCaptureSessions();el("pd-wb-session").replaceChildren(new Option("Select capture session",""),...sessions.map(s=>new Option(s.name+" ("+s.captures.length+")",s.id)));if(sessions.some(s=>s.id===selected))el("pd-wb-session").value=selected;}
 function clear(){lastReport=null;el("pd-wb-results").replaceChildren();el("pd-wb-summary").textContent="";}
 el("pd-wb-refresh").addEventListener("click",()=>refresh().catch(e=>setStatus(e.message)));
 el("pd-wb-load").addEventListener("click",async()=>{try{const session=await getCaptureSession(el("pd-wb-session").value);if(!session)throw Error("Select a capture session");const hex=session.captures.map(c=>c?.hex).filter(h=>typeof h==="string"&&/^[0-9a-f]+$/i.test(h)&&h.length%2===0);el("pd-wb-packets").value=hex.slice(0,24).join("\n");clear();setStatus("Loaded "+Math.min(24,hex.length)+" packets from "+session.name+(hex.length>24?" (first 24 only).":"."));}catch(e){setStatus(e.message);}});
 el("pd-wb-packets").addEventListener("input",clear);
 el("pd-wb-compare").addEventListener("click",()=>{try{
  const packets=el("pd-wb-packets").value.split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,"")).filter(Boolean);
  const report=compareProtocolPackets(getDefinition(),packets);lastReport=report;
  const root=el("pd-wb-results");root.replaceChildren();
  const table=document.createElement("table");table.id="pd-wb-table";
  function row(cells,{header=false,changed=false}={}){const tr=document.createElement("tr");for(const value of cells){const td=document.createElement(header?"th":"td");td.textContent=String(value);if(changed)td.style.fontWeight="bold";tr.append(td);}table.append(tr);}
  row(["Field / byte",...report.rows.map(r=>r.id)],{header:true});
  row(["Packet",...report.rows.map(r=>r.hex)]);
  row(["Match",...report.rows.map(r=>r.matched?"Yes":r.reason??"No")]);
  row(["Checksum",...report.rows.map(r=>r.checksumsValid===null?"N/A":r.checksumsValid?"Valid":"Invalid")]);
  for(const field of report.fields)row([field.name+" ("+field.type+")",...field.values.map(v=>v==null?"—":String(v.label??v.value)+(v.valid===false?" (invalid)":""))],{changed:field.changed});
  for(const byte of report.byteDiffs)row(["Byte "+byte.offset,...byte.values.map(v=>v??"—")],{changed:byte.changed});
  root.append(table);
  el("pd-wb-summary").textContent=report.matched+"/"+report.total+" matched · "+report.fields.filter(f=>f.changed).length+" changed fields · "+report.byteDiffs.filter(b=>b.changed).length+" changed bytes · "+report.checksumFailures+" checksum failures.";
  setStatus("Workbench comparison ready.");
 }catch(e){clear();setStatus(e.message);}});
 el("pd-wb-export").addEventListener("click",()=>{if(!lastReport){setStatus("Compare packets before exporting.");return;}const url=URL.createObjectURL(new Blob([JSON.stringify(lastReport,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=lastReport.protocolId+"-comparison.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 refresh().catch(e=>setStatus(e.message));
 return {refresh};
}
