import { parseFlipperRaw, analyzePulses } from "../rx/signal-fingerprint.js";
import { decodeHypotheses } from "../rx/signal-decode.js";
import {saveSignalAnalysis,loadSignalAnalysis,listSignalAnalyses,deleteSignalAnalysis} from "../storage/signal-analysis-store.js";
export function initSignalAnalyzer() {
  const input=document.getElementById("signal-sub-file");
  const result=document.getElementById("signal-analysis-results");
  const canvas=document.getElementById("signal-waveform");
  const zoom=document.getElementById("signal-zoom");
  if (!input || !result || !canvas) return;
  let capture=null;
  const savedSelect=document.getElementById("signal-saved-select");
  async function refreshSaved(){const items=await listSignalAnalyses();savedSelect.replaceChildren(...items.map(item=>{const option=document.createElement("option");option.value=item.id;option.textContent=`${item.name} · ${item.createdAt}`;return option;}));}
  const cursorA=document.getElementById("signal-cursor-a");
  const cursorB=document.getElementById("signal-cursor-b");
  const delta=document.getElementById("signal-delta");
  const totalUs=()=>capture?.durationsUs.reduce((sum,v)=>sum+Math.abs(v),0)??0;
  function updateCursors(){
    const a=Number(cursorA.value),b=Number(cursorB.value),total=totalUs();
    delta.textContent=Number.isFinite(a)&&Number.isFinite(b)?`Δt: ${Math.abs(b-a).toLocaleString()} µs (capture: ${total.toLocaleString()} µs)`:"Invalid cursor";
    draw();
  }
  cursorA.addEventListener("input",updateCursors);
  cursorB.addEventListener("input",updateCursors);
  function draw() {
    if (!capture) return;
    const ctx=canvas.getContext("2d");
    const width=canvas.width, height=canvas.height;
    ctx.clearRect(0,0,width,height);
    const total=capture.durationsUs.reduce((a,b)=>a+Math.abs(b),0);
    const scale=Number(zoom.value);
    const visible=total/scale;
    const offset=Number(document.getElementById("signal-pan").value)/100*Math.max(0,total-visible);
    let t=0;
    ctx.strokeStyle="#2b9e9a";ctx.lineWidth=2;ctx.beginPath();
    for (const d of capture.durationsUs) {
      const start=t; t+=Math.abs(d);
      if (t<offset || start>offset+visible) continue;
      const x0=(start-offset)/visible*width,x1=(t-offset)/visible*width,y=d>0?height*.25:height*.75;
      ctx.moveTo(x0,y);ctx.lineTo(x1,y);
      ctx.moveTo(x1,y);ctx.lineTo(x1,d>0?height*.75:height*.25);
    }
    ctx.stroke();
    for(const [cursor,color] of [[cursorA,"#e69f00"],[cursorB,"#c55"]]){
      const pos=Number(cursor.value);
      if(!Number.isFinite(pos)||pos<offset||pos>offset+visible)continue;
      const x=(pos-offset)/visible*width;
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();
    }
    document.getElementById("signal-window").textContent=`Window: ${Math.round(offset)}–${Math.round(offset+visible)} µs`;
  }
  function showCapture(next){
    capture=next;
    const a=analyzePulses(capture);
    result.replaceChildren();
    const pre=document.createElement("pre");
    let hypotheses=[];
    try { if(a.estimatedUnitUs) hypotheses=decodeHypotheses(a.frames[0]?.durationsUs??capture.durationsUs,a.estimatedUnitUs).candidates.map(({encoding,bits,confidence,errors,verified})=>({encoding,bitstreamPreview:bits.slice(0,256),bitLength:bits.length,confidence,errors,verified})); }
    catch(e){hypotheses=[{warning:e.message}];}
    pre.textContent=JSON.stringify({source:capture.source,frequencyHz:capture.frequencyHz,configuredModulation:a.configuredModulation,verifiedModulation:a.verifiedModulation,estimatedUnitUs:a.estimatedUnitUs,timingConsistency:a.timingConsistency,clusters:a.clusters,gaps:a.gaps,frameCount:a.frames.length,candidates:a.candidates,decodedHypotheses:hypotheses,warnings:a.warnings},null,2);
    result.append(pre);updateCursors();
  }
  input.addEventListener("change",async()=>{
    try {
      if(!input.files?.[0])return;
      if(input.files[0].size>4*1024*1024)throw Error("RAW file exceeds 4 MiB limit");
      showCapture(parseFlipperRaw(await input.files[0].text()));
      return;
    } catch(e) {capture=null;result.textContent="Import error: "+e.message;}
  });
  document.getElementById("signal-save").addEventListener("click",async()=>{try{if(!capture)throw Error("Import a capture first");const entry=await saveSignalAnalysis(capture);await refreshSaved();savedSelect.value=entry.id;result.insertAdjacentText("beforeend","\nSaved to IndexedDB.");}catch(e){result.textContent="Save error: "+e.message;}});
  document.getElementById("signal-load").addEventListener("click",async()=>{try{if(!savedSelect.value)throw Error("Select a saved capture");showCapture((await loadSignalAnalysis(savedSelect.value)).capture);}catch(e){result.textContent="Load error: "+e.message;}});
  document.getElementById("signal-clear").addEventListener("click",async()=>{try{if(!savedSelect.value)throw Error("Select a saved capture");await deleteSignalAnalysis(savedSelect.value);await refreshSaved();result.insertAdjacentText("beforeend","\nSaved analysis deleted.");}catch(e){result.textContent="Delete error: "+e.message;}});
  refreshSaved().catch(e=>{result.textContent="IndexedDB unavailable: "+e.message;});
  zoom.addEventListener("input",draw);
  document.getElementById("signal-pan").addEventListener("input",draw);
}
initSignalAnalyzer();
