import { parseFlipperRaw, analyzePulses } from "../rx/signal-fingerprint.js";
import { decodeHypotheses } from "../rx/signal-decode.js";
export function initSignalAnalyzer() {
  const input=document.getElementById("signal-sub-file");
  const result=document.getElementById("signal-analysis-results");
  const canvas=document.getElementById("signal-waveform");
  const zoom=document.getElementById("signal-zoom");
  if (!input || !result || !canvas) return;
  let capture=null;
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
    document.getElementById("signal-window").textContent=`Window: ${Math.round(offset)}–${Math.round(offset+visible)} µs`;
  }
  input.addEventListener("change",async()=>{
    try {
      capture=parseFlipperRaw(await input.files[0].text());
      const a=analyzePulses(capture);
      result.replaceChildren();
      const pre=document.createElement("pre");
      pre.textContent=JSON.stringify({
        frequencyHz:capture.frequencyHz,preset:capture.configuredPreset,
        configuredModulation:a.configuredModulation,verifiedModulation:a.verifiedModulation,
        modulationFinding:a.modulationFinding,estimatedUnitUs:a.estimatedUnitUs,
        estimatedSymbolRate:a.estimatedSymbolRate,bitrateStatus:a.bitrateStatus,
        timingConsistency:a.timingConsistency,clusters:a.clusters,gaps:a.gaps,
        frameCount:a.frames.length,candidates:a.candidates,decodedHypotheses:a.estimatedUnitUs ? decodeHypotheses(a.frames[0]?.durationsUs ?? capture.durationsUs,a.estimatedUnitUs).candidates.map(({encoding,bits,confidence,errors,verified})=>({encoding,bitstreamPreview:bits.slice(0,256),bitLength:bits.length,confidence,errors,verified})) : [],warnings:a.warnings
      },null,2);
      result.append(pre);draw();
    } catch(e) {capture=null;result.textContent="Import error: "+e.message;}
  });
  zoom.addEventListener("input",draw);
  document.getElementById("signal-pan").addEventListener("input",draw);
}
initSignalAnalyzer();
