import {inspectField,defineProtocol,inferVariableRuns,checksumCandidates} from "../rx/protocol-workbench.js";
import {timingHistogram,compareAlignedCaptures,pulseRange} from "../rx/signal-workbench.js";
import { waveformWindow, cursorTimeFromX, cursorXFromTime } from "../rx/waveform-cursors.js";
import { parseFlipperRaw, analyzePulses } from "../rx/signal-fingerprint.js";
import { decodeHypotheses, findPreambleCandidates, alignBitstreams } from "../rx/signal-decode.js";
import {saveSignalAnalysis,loadSignalAnalysis,listSignalAnalyses,deleteSignalAnalysis} from "../storage/signal-analysis-store.js";
export function initSignalAnalyzer() {
  const input=document.getElementById("signal-sub-file");
  const result=document.getElementById("signal-analysis-results");
  const canvas=document.getElementById("signal-waveform");
  const zoom=document.getElementById("signal-zoom");
  if (!input || !result || !canvas) return;
  let capture=null;
  let selectedIndices=[];
  let currentReport=null;
  const timingLevel=document.getElementById("signal-timing-level");
  const timingChart=document.getElementById("signal-timing-chart");
  const timingSelection=document.getElementById("signal-timing-selection");
  const decodeChoice=document.getElementById("signal-decode-choice");
  const invertBits=document.getElementById("signal-invert-bits");
  const decodePreview=document.getElementById("signal-decode-preview");
  const frameCompare=document.getElementById("signal-frame-compare");
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
  // Pointer capture supports dragging beyond the canvas bounds.
  let activeCursor=null;
  const pan=document.getElementById("signal-pan");
  const pointerX=event=>{
    const rect=canvas.getBoundingClientRect();
    return (event.clientX-rect.left)/rect.width*canvas.width;
  };
  const nearestCursor=x=>{
    const a=cursorXFromTime(Number(cursorA.value),canvas.width,totalUs(),Number(zoom.value),Number(pan.value)/100);
    const b=cursorXFromTime(Number(cursorB.value),canvas.width,totalUs(),Number(zoom.value),Number(pan.value)/100);
    return Math.abs(x-a)<=Math.abs(x-b)?cursorA:cursorB;
  };
  const moveCursor=event=>{
    if(!capture||!activeCursor)return;
    activeCursor.value=String(cursorTimeFromX(pointerX(event),canvas.width,totalUs(),Number(zoom.value),Number(pan.value)/100));
    updateCursors();
  };
  canvas.style.touchAction="none";
  canvas.style.cursor="crosshair";
  canvas.addEventListener("pointerdown",event=>{
    if(!capture||event.button!==0)return;
    activeCursor=nearestCursor(pointerX(event));
    canvas.setPointerCapture(event.pointerId);
    moveCursor(event);
  });
  canvas.addEventListener("pointermove",event=>{
    if(activeCursor&&canvas.hasPointerCapture(event.pointerId))moveCursor(event);
  });
  const finishDrag=()=>{activeCursor=null;};
  canvas.addEventListener("pointerup",finishDrag);
  canvas.addEventListener("pointercancel",finishDrag);
  canvas.addEventListener("lostpointercapture",finishDrag);
  cursorA.addEventListener("input",updateCursors);
  cursorB.addEventListener("input",updateCursors);
  function draw() {
    if (!capture) return;
    const ctx=canvas.getContext("2d");
    const width=canvas.width, height=canvas.height;
    ctx.clearRect(0,0,width,height);
    const total=capture.durationsUs.reduce((a,b)=>a+Math.abs(b),0);
    const scale=Number(zoom.value);
    const {visible,offset}=waveformWindow(total,scale,Number(pan.value)/100);
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
    if(selectedIndices.length){
      const wanted=new Set(selectedIndices);let elapsed=0;
      ctx.fillStyle="rgba(247,183,74,.22)";
      capture.durationsUs.forEach((d,i)=>{
        const start=elapsed;elapsed+=Math.abs(d);
        if(!wanted.has(i)||elapsed<offset||start>offset+visible)return;
        const left=Math.max(0,(start-offset)/visible*width),right=Math.min(width,(elapsed-offset)/visible*width);
        ctx.fillRect(left,0,Math.max(1,right-left),height);
      });
    }
    for(const [cursor,color] of [[cursorA,"#e69f00"],[cursorB,"#c55"]]){
      const pos=Number(cursor.value);
      if(!Number.isFinite(pos)||pos<offset||pos>offset+visible)continue;
      const x=cursorXFromTime(pos,width,total,scale,Number(pan.value)/100);
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();
    }
    document.getElementById("signal-window").textContent=`Window: ${Math.round(offset)}–${Math.round(offset+visible)} µs`;
  }
  const protocolBits=document.getElementById("protocol-bit-inspector");
  const protocolFields=document.getElementById("protocol-field-list");
  const protocolInference=document.getElementById("protocol-inference");
  const protocolStatus=document.getElementById("protocol-workbench-status");
  const fieldStart=document.getElementById("protocol-field-start");
  const fieldLength=document.getElementById("protocol-field-length");
  const fieldName=document.getElementById("protocol-field-name");
  const fieldOrder=document.getElementById("protocol-field-order");
  const protocolName=document.getElementById("protocol-workbench-name");
  let protocolFieldsData=[];
  let analyzedFrames=[];
  const candidateBits=()=>{
    const c=currentReport?.hypotheses?.[Number(decodeChoice.value)];
    return c?(invertBits.checked?c.bits.replace(/[01]/g,b=>b==="0"?"1":"0"):c.bits):"";
  };
  function renderProtocol(){
    const bits=candidateBits();
    protocolBits.replaceChildren();
    if(!bits){protocolBits.textContent="Import a capture and select a decode hypothesis.";protocolFields.textContent="No candidate bits.";protocolInference.textContent="Awaiting capture.";return;}
    const start=Number(fieldStart.value),length=Number(fieldLength.value);
    for(let i=0;i<Math.min(bits.length,2048);i++){
      const span=document.createElement("span");span.textContent=bits[i];
      span.className=i>=start&&i<start+length?"protocol-selected-bit":"";
      span.dataset.index=String(i);protocolBits.append(span);
      if((i+1)%8===0)protocolBits.append(document.createTextNode(" "));
      if((i+1)%64===0)protocolBits.append(document.createTextNode("\n"));
    }
    if(bits.length>2048)protocolBits.append(document.createTextNode("\nPreview truncated to 2048 bits."));
    protocolFields.replaceChildren();
    for(const field of protocolFieldsData){
      const line=document.createElement("div");line.className="protocol-field-row";
      try{const inspected=inspectField(bits,field.start,field.length,field);line.textContent=`${field.name} [${field.start}:${field.start+field.length}] ${inspected.hex} (${inspected.decimal})`;}
      catch(error){line.textContent=field.name+": "+error.message;}
      const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";remove.addEventListener("click",()=>{protocolFieldsData=protocolFieldsData.filter(f=>f!==field);renderProtocol();});line.append(remove);protocolFields.append(line);
    }
    if(!protocolFieldsData.length)protocolFields.textContent="No fields defined.";
    try{
      const chosen=currentReport?.hypotheses?.[Number(decodeChoice.value)];
      const frames=analyzedFrames.map(p=>decodeHypotheses(p,currentReport.unitUs).candidates.find(c=>c.encoding===chosen.encoding)?.bits).filter(Boolean);
      const normalized=invertBits.checked?frames.map(s=>s.replace(/[01]/g,b=>b==="0"?"1":"0")):frames;
      const inference=normalized.length>=2?inferVariableRuns(normalized):{warning:"Two or more equally sized decoded frames are needed for variable-region inference."};
      const checks=bits.length%8===0&&bits.length>=16?checksumCandidates(bits.match(/.{8}/g).map(b=>parseInt(b,2))):[];
      protocolInference.textContent=JSON.stringify({inference,checks,warning:"Checksum matches are coincidences until verified with independent samples."},null,2);
    }catch(error){protocolInference.textContent="Inference unavailable: "+error.message;}
  }
  protocolBits.addEventListener("click",event=>{const i=event.target.dataset?.index;if(i===undefined)return;fieldStart.value=i;renderProtocol();});
  for(const el of [fieldStart,fieldLength])el.addEventListener("input",renderProtocol);
  document.getElementById("protocol-field-add").addEventListener("click",()=>{
    try{const bits=candidateBits();const field={name:fieldName.value.trim(),start:Number(fieldStart.value),length:Number(fieldLength.value),endianness:fieldOrder.value};defineProtocol({name:protocolName.value,bitLength:bits.length,fields:[...protocolFieldsData,field]});protocolFieldsData.push(field);protocolStatus.textContent="Field added (unverified).";renderProtocol();}
    catch(error){protocolStatus.textContent=error.message;}
  });
  document.getElementById("protocol-fields-clear").addEventListener("click",()=>{protocolFieldsData=[];protocolStatus.textContent="Fields cleared.";renderProtocol();});
  document.getElementById("protocol-definition-export").addEventListener("click",()=>{
    try{const bits=candidateBits();const definition=defineProtocol({name:protocolName.value,bitLength:bits.length,fields:protocolFieldsData});const url=URL.createObjectURL(new Blob([JSON.stringify({...definition,encoding:currentReport.hypotheses[Number(decodeChoice.value)].encoding,warning:"Candidate protocol only; verify with independent captures."},null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="rfcat-protocol-definition.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);protocolStatus.textContent="Definition exported locally.";}
    catch(error){protocolStatus.textContent=error.message;}
  });
  function renderDecode(){
    const candidate=currentReport?.hypotheses?.[Number(decodeChoice.value)];
    if(!candidate){decodePreview.textContent="No candidate available.";renderProtocol();return;}
    const bits=invertBits.checked?candidate.bits.replace(/[01]/g,bit=>bit==="0"?"1":"0"):candidate.bits;
    decodePreview.textContent=JSON.stringify({encoding:candidate.encoding,confidence:candidate.confidence,errors:candidate.errors,verified:candidate.verified,bitLength:bits.length,preview:bits.slice(0,512),note:"Unverified candidate; polarity and framing may be incorrect."},null,2);
    renderProtocol();
  }
  function renderWorkbench(analysis){
    selectedIndices=[];currentReport=null;timingSelection.textContent="Select a histogram bar to highlight matching pulses.";
    const hist=timingHistogram(capture.durationsUs);
    const frames=analysis.frames.slice(0,12).map(f=>f.durationsUs);
    let comparison=null;
    if(frames.length>=2)comparison=compareAlignedCaptures(frames);
    frameCompare.replaceChildren();
    if(comparison){
      const summary=document.createElement("p");
      summary.textContent=`${comparison.framesCompared} frames · ${comparison.comparedPulses} aligned pulse positions · ${comparison.stableCount} exact matches`;
      const pre=document.createElement("pre");
      pre.textContent=comparison.positions.slice(0,128).map(p=>p.stable?"·":"▲").join("")+"\n"+comparison.warning;
      frameCompare.append(summary,pre);
    }else frameCompare.textContent="At least two segmented frames are required.";
    let hypotheses=[];
    if(analysis.estimatedUnitUs){
      try{hypotheses=decodeHypotheses(analysis.frames[0]?.durationsUs??capture.durationsUs,analysis.estimatedUnitUs).candidates;}catch(error){decodePreview.textContent=error.message;}
    }
    currentReport={histogram:hist,comparison,hypotheses,unitUs:analysis.estimatedUnitUs};
    analyzedFrames=frames;
    protocolFieldsData=[];
    decodeChoice.replaceChildren();
    hypotheses.forEach((candidate,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=`${candidate.encoding} · ${candidate.confidence}% heuristic`;decodeChoice.append(option);});
    renderDecode();
    const level=timingLevel.value;timingChart.replaceChildren();
    const bins=[...hist[level]].sort((a,b)=>b.count-a.count).slice(0,24).sort((a,b)=>a.startUs-b.startUs);
    const max=Math.max(1,...bins.map(b=>b.count));
    for(const bin of bins){
      const button=document.createElement("button");button.type="button";button.className="signal-hist-bin";
      button.setAttribute("aria-pressed","false");
      button.setAttribute("aria-label",`${level} ${bin.startUs} to ${bin.endUs} microseconds: ${bin.count} pulses`);
      const bar=document.createElement("span");bar.className="signal-hist-bar";bar.style.height=`${Math.max(4,Math.round(bin.count/max*100))}%`;
      const caption=document.createElement("small");caption.textContent=String(bin.startUs);
      button.append(bar,caption);
      button.addEventListener("click",()=>{
        const wasSelected=button.getAttribute("aria-pressed")==="true";
        for(const other of timingChart.children)other.setAttribute("aria-pressed","false");
        selectedIndices=wasSelected?[]:bin.indices;
        button.setAttribute("aria-pressed",String(!wasSelected));
        const range=pulseRange(capture.durationsUs,selectedIndices);
        timingSelection.textContent=range?`${bin.count} matching ${level} intervals · ${bin.startUs}–${bin.endUs} µs · time span ${range.startUs}–${range.endUs} µs`:"No timing cluster selected.";
        draw();
      });
      timingChart.append(button);
    }
    if(!bins.length)timingChart.textContent="No matching intervals.";
    draw();
  }
  timingLevel.addEventListener("change",()=>{if(capture)renderWorkbench(analyzePulses(capture));});
  decodeChoice.addEventListener("change",renderDecode);
  invertBits.addEventListener("change",renderDecode);
  document.getElementById("signal-export-report").addEventListener("click",()=>{
    if(!capture||!currentReport){timingSelection.textContent="Import a capture before exporting.";return;}
    const report={schema:"rfcat-signal-workbench-v1",source:capture.source,frequencyHz:capture.frequencyHz,configuredModulation:capture.configuredModulation,verifiedModulation:null,histogram:currentReport.histogram,frameComparison:currentReport.comparison,decodedHypotheses:currentReport.hypotheses.map(h=>({encoding:h.encoding,bits:h.bits,confidence:h.confidence,errors:h.errors,verified:h.verified})),warning:"Offline heuristic analysis only; no RF modulation or protocol is verified."};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="rfcat-signal-analysis.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function showCapture(next){
    capture=next;
    const a=analyzePulses(capture);
    result.replaceChildren();
    const pre=document.createElement("pre");
    let hypotheses=[];
    let frameComparison=null;
    try { if(a.estimatedUnitUs) hypotheses=decodeHypotheses(a.frames[0]?.durationsUs??capture.durationsUs,a.estimatedUnitUs).candidates.map(({encoding,bits,confidence,errors,verified})=>({encoding,bitstreamPreview:bits.slice(0,256),bitLength:bits.length,confidence,errors,verified})); }
    catch(e){hypotheses=[{warning:e.message}];}
    try {
      const frameBits=a.frames.slice(0,12).map(frame=>decodeHypotheses(frame.durationsUs,a.estimatedUnitUs).candidates.find(candidate=>candidate.encoding==="NRZ")?.bits).filter(Boolean);
      if(frameBits.length>=2)frameComparison=alignBitstreams(frameBits);
    }catch(e){frameComparison={warning:e.message};}
    const preambleCandidates=hypotheses.find(h=>h.encoding==="NRZ")?.bitstreamPreview ? findPreambleCandidates(hypotheses.find(h=>h.encoding==="NRZ").bitstreamPreview) : null;
    pre.textContent=JSON.stringify({source:capture.source,frequencyHz:capture.frequencyHz,configuredModulation:a.configuredModulation,verifiedModulation:a.verifiedModulation,estimatedUnitUs:a.estimatedUnitUs,timingConsistency:a.timingConsistency,clusters:a.clusters,gaps:a.gaps,frameCount:a.frames.length,candidates:a.candidates,decodedHypotheses:hypotheses,frameComparison,preambleCandidates,warnings:a.warnings},null,2);
    result.append(pre);renderWorkbench(a);updateCursors();
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
  pan.addEventListener("input",draw);
}
initSignalAnalyzer();
