import {sweepSpectrum} from "../rx/spectrum.js";
export function initSpectrumExplorer({radio,isBusy=()=>false}){
 const host=document.querySelector("#signal-analyzer-panel");
 if(!host)return;
 const panel=document.createElement("details");panel.className="card collapsible";panel.id="spectrum-explorer";
 panel.innerHTML=`<summary class="section-summary"><span>Sub-GHz Spectrum Explorer</span><span class="summary-note">Stepped CC1111 RSSI · receive only</span></summary>
 <div class="section-body"><p>Sequential RSSI measurements, not a wideband FFT. Pause other radio operations before scanning.</p>
 <div class="grid"><label>Start (MHz)<input id="spectrum-start" type="number" step=".001" value="433.820"></label><label>Stop (MHz)<input id="spectrum-stop" type="number" step=".001" value="434.020"></label><label>Step (kHz)<input id="spectrum-step" type="number" min="10" max="1000" value="50"></label><label>Dwell (ms)<input id="spectrum-dwell" type="number" min="20" max="2000" value="100"></label><label>Passes<input id="spectrum-passes" type="number" min="1" max="100" value="10"></label><label>Peak threshold (dBm)<input id="spectrum-threshold" type="number" value="-80"></label></div>
 <div class="actions"><button id="spectrum-start-button" type="button">Start sweep</button><button id="spectrum-stop-button" type="button" disabled>Stop</button><button id="spectrum-export" type="button" disabled>Export CSV</button></div>
 <p id="spectrum-status" role="status">Connect a YARD Stick One to scan.</p>
 <canvas id="spectrum-plot" width="960" height="260" style="width:100%;max-width:100%;border:1px solid #777" aria-label="RSSI spectrum chart"></canvas>
 <p id="spectrum-peaks">No samples.</p><p class="muted">Click the chart to select a frequency for the receiver; the radio remains idle after scanning.</p></div>`;
 host.before(panel);
 const get=id=>panel.querySelector("#"+id);
 const start=get("spectrum-start-button"),stop=get("spectrum-stop-button"),status=get("spectrum-status"),canvas=get("spectrum-plot"),ctx=canvas.getContext("2d");
 let controller=null,samples=[];
 const peakSamples=new Map();
 function render(){
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#14212b";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#506474";ctx.strokeRect(40,12,w-54,h-40);
  if(!samples.length)return;
  const lo=Math.min(...samples.map(s=>s.rssiDbm),-110)-5,hi=Math.max(...samples.map(s=>s.rssiDbm),-30)+5;
  const distinct=[...peakSamples.values()].sort((a,b)=>a.frequencyHz-b.frequencyHz);
  const x=i=>40+(w-54)*(distinct.length===1?0:i/(distinct.length-1));
  const y=v=>12+(h-40)*(hi-v)/(hi-lo);
  ctx.strokeStyle="#3fc3ae";ctx.lineWidth=2;ctx.beginPath();
  distinct.forEach((s,i)=>{if(i===0)ctx.moveTo(x(i),y(s.rssiDbm));else ctx.lineTo(x(i),y(s.rssiDbm));});ctx.stroke();
  const threshold=Number(get("spectrum-threshold").value);
  ctx.fillStyle="#f2bb63";
  distinct.forEach((s,i)=>{if(s.rssiDbm>=threshold){ctx.beginPath();ctx.arc(x(i),y(s.rssiDbm),3,0,Math.PI*2);ctx.fill();}});
  const peaks=distinct.filter(s=>s.rssiDbm>=threshold).sort((a,b)=>b.rssiDbm-a.rssiDbm).slice(0,8);
  get("spectrum-peaks").textContent=peaks.length?"Strongest above threshold: "+peaks.map(s=>(s.frequencyHz/1e6).toFixed(3)+" MHz ("+s.rssiDbm.toFixed(1)+" dBm)").join(" · "):"No peaks above threshold.";
 }
 get("spectrum-threshold").addEventListener("input",render);
 canvas.addEventListener("click",event=>{
  if(!samples.length||controller)return;
  const rect=canvas.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*canvas.width-40)/(canvas.width-54)));
  const distinct=[...peakSamples.values()].sort((a,b)=>a.frequencyHz-b.frequencyHz);
  const sample=distinct[Math.round(fraction*(distinct.length-1))];
  if(!sample)return;
  const freq=document.getElementById("freq");
  if(freq){freq.value=(sample.frequencyHz/1e6).toFixed(3);freq.dispatchEvent(new Event("change",{bubbles:true}));}
  status.textContent="Selected "+(sample.frequencyHz/1e6).toFixed(3)+" MHz in radio form. Apply configuration before receiving.";
 });
 get("spectrum-export").addEventListener("click",()=>{
  const csv="frequency_hz,rssi_dbm,timestamp\n"+samples.map(s=>[s.frequencyHz,s.rssiDbm,s.timestamp].join(",")).join("\n")+"\n";
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const a=document.createElement("a");a.href=url;a.download="rfcat-spectrum.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 start.addEventListener("click",async()=>{
  if(controller)return;
  if(isBusy()){status.textContent="Stop active receiving or chat before scanning.";return;}
  controller=new AbortController();start.disabled=true;stop.disabled=false;samples=[];peakSamples.clear();render();get("spectrum-export").disabled=true;
  try{
   const result=await sweepSpectrum(radio,{startMHz:Number(get("spectrum-start").value),stopMHz:Number(get("spectrum-stop").value),stepKHz:Number(get("spectrum-step").value),dwellMs:Number(get("spectrum-dwell").value),passes:Number(get("spectrum-passes").value),signal:controller.signal,onSample:(sample,count,total)=>{samples.push(sample);const previous=peakSamples.get(sample.frequencyHz);if(!previous||sample.rssiDbm>previous.rssiDbm)peakSamples.set(sample.frequencyHz,sample);status.textContent="Sampling "+count+"/"+total+" · peak hold";render();}});
   status.textContent=result.cancelled?"Scan cancelled; radio configuration restored.":"Scan complete: "+samples.length+" RSSI samples; radio left idle.";
  }catch(e){status.textContent="Scan error: "+e.message;}
  finally{controller=null;start.disabled=false;stop.disabled=true;get("spectrum-export").disabled=!samples.length;}
 });
 stop.addEventListener("click",()=>{if(!controller)return;controller.abort();stop.disabled=true;status.textContent="Stopping scan; restoring radio configuration…";});
}
