import {sweepSpectrum} from "../rx/spectrum.js";
import {summarizeSpectrum,compareSpectrum,spectrumCsv} from "../rx/spectrum-analysis.js";

export function initSpectrumExplorer({radio,isBusy=()=>false}){
 const host=document.querySelector("#signal-analyzer-panel");
 if(!host)return;
 const panel=document.createElement("details");
 panel.className="card collapsible";panel.id="spectrum-explorer";
 panel.innerHTML=`<summary class="section-summary"><span>Sub-GHz Spectrum Explorer</span><span class="summary-note">Stepped CC1111 RSSI · receive only</span></summary>
 <div class="section-body"><p>Sequential RSSI measurements, not a wideband FFT. Pause other radio operations before scanning.</p>
 <div class="grid"><label>Start (MHz)<input id="spectrum-start" type="number" step=".001" value="433.870"></label><label>Stop (MHz)<input id="spectrum-stop" type="number" step=".001" value="433.970"></label><label>Step (kHz)<input id="spectrum-step" type="number" min="10" max="1000" value="25"></label><label>Dwell (ms)<input id="spectrum-dwell" type="number" min="20" max="2000" value="150"></label><label>Passes<input id="spectrum-passes" type="number" min="1" max="100" value="20"></label><label>Peak threshold (dBm)<input id="spectrum-threshold" type="number" value="-115"></label><label>Minimum baseline rise (dB)<input id="spectrum-delta" type="number" min="0" max="100" value="6"></label></div>
 <div class="actions"><button id="spectrum-baseline" type="button">Capture baseline (TX off)</button><button id="spectrum-start-button" type="button">Scan signal (TX on)</button><button id="spectrum-stop-button" type="button" disabled>Stop</button><button id="spectrum-export" type="button" disabled>Export CSV</button><button id="spectrum-clear-baseline" type="button" disabled>Clear baseline</button></div>
 <p id="spectrum-status" role="status">Connect a YARD Stick One to scan.</p>
 <canvas id="spectrum-plot" width="960" height="320" style="width:100%;max-width:100%;border:1px solid #777" aria-label="RSSI by frequency with labeled dBm axis"></canvas>
 <p id="spectrum-peaks">No samples.</p><p class="muted">Green: average RSSI · Orange: peak RSSI · Gray: baseline average. Highlighted frequencies rise above baseline by the configured minimum. Click the chart to select a frequency for the receiver.</p></div>`;
 host.before(panel);
 const get=id=>panel.querySelector("#"+id);
 const start=get("spectrum-start-button"),baseButton=get("spectrum-baseline"),stop=get("spectrum-stop-button"),status=get("spectrum-status"),canvas=get("spectrum-plot"),ctx=canvas.getContext("2d");
 let controller=null,samples=[],baseline=[],baselineSettings=null,lastSettings=null;
 const settings=()=>({startMHz:Number(get("spectrum-start").value),stopMHz:Number(get("spectrum-stop").value),stepKHz:Number(get("spectrum-step").value),dwellMs:Number(get("spectrum-dwell").value),passes:Number(get("spectrum-passes").value)});
 const scanKey=s=>[s.startMHz,s.stopMHz,s.stepKHz].join("/");
 const rows=()=>compareSpectrum(summarizeSpectrum(samples),baseline);
 function render(){
  const w=canvas.width,h=canvas.height,left=78,right=22,top=18,bottom=43,pw=w-left-right,ph=h-top-bottom;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#14212b";ctx.fillRect(0,0,w,h);
  const data=rows(),all=[...data.flatMap(r=>[r.averageDbm,r.peakDbm]),...baseline.map(r=>r.averageDbm)];
  const min=all.length?Math.floor((Math.min(...all)-5)/10)*10:-120,max=all.length?Math.ceil((Math.max(...all)+5)/10)*10:-30;
  const low=Math.min(min,-120),high=Math.max(max,-30);
  const y=v=>top+(high-v)/(high-low)*ph;
  ctx.font="13px sans-serif";ctx.textAlign="right";ctx.fillStyle="#c6d1da";ctx.strokeStyle="#344958";
  for(let db=Math.ceil(low/10)*10;db<=high;db+=10){const py=y(db);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(w-right,py);ctx.stroke();ctx.fillText(db+" dBm",left-9,py+4);}
  const frequencies=[...new Set([...data,...baseline].map(r=>r.frequencyHz))].sort((a,b)=>a-b);
  const x=hz=>left+(frequencies.length<2?pw/2:(frequencies.indexOf(hz)/(frequencies.length-1))*pw);
  ctx.textAlign="center";ctx.fillStyle="#c6d1da";
  frequencies.forEach((hz,i)=>{if(frequencies.length<=7||i%Math.ceil(frequencies.length/7)===0||i===frequencies.length-1)ctx.fillText((hz/1e6).toFixed(3),x(hz),h-17);});
  const trace=(points,key,color)=>{if(!points.length)return;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();points.forEach((r,i)=>{if(i)ctx.lineTo(x(r.frequencyHz),y(r[key]));else ctx.moveTo(x(r.frequencyHz),y(r[key]));});ctx.stroke();};
  trace(baseline,"averageDbm","#a2aab7");trace(data,"averageDbm","#3fc3ae");trace(data,"peakDbm","#f2bb63");
  const delta=Number(get("spectrum-delta").value),threshold=Number(get("spectrum-threshold").value);
  for(const r of data){if((r.deltaDb!==null&&r.deltaDb>=delta)||(r.peakDbm>=threshold&&!baseline.length)){ctx.fillStyle="#ffda7a";ctx.beginPath();ctx.arc(x(r.frequencyHz),y(r.averageDbm),5,0,Math.PI*2);ctx.fill();}}
  const strongest=[...data].sort((a,b)=>baseline.length?(b.deltaDb??-Infinity)-(a.deltaDb??-Infinity):b.peakDbm-a.peakDbm)[0];
  get("spectrum-peaks").textContent=!strongest?(baseline.length?"Baseline saved ("+baseline.length+" frequencies). Scan with TX on.":"No samples."):("Strongest "+(baseline.length?"baseline rise":"peak")+": "+(strongest.frequencyHz/1e6).toFixed(3)+" MHz · avg "+strongest.averageDbm.toFixed(1)+" dBm · peak "+strongest.peakDbm.toFixed(1)+" dBm"+(strongest.deltaDb===null?"":" · rise "+strongest.deltaDb.toFixed(1)+" dB")+(baseline.length?" · "+data.filter(r=>r.deltaDb!==null&&r.deltaDb>=delta).length+" frequencies ≥ "+delta+" dB above baseline":""));
 }
 get("spectrum-threshold").addEventListener("input",render);
 get("spectrum-delta").addEventListener("input",render);
 canvas.addEventListener("click",event=>{
  if(controller)return;
  const data=rows();if(!data.length)return;
  const rect=canvas.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*canvas.width-78)/(canvas.width-100)));
  const sample=data[Math.round(fraction*(data.length-1))];if(!sample)return;
  const freq=document.getElementById("freq");
  if(freq){freq.value=(sample.frequencyHz/1e6).toFixed(3);freq.dispatchEvent(new Event("change",{bubbles:true}));}
  status.textContent="Selected "+(sample.frequencyHz/1e6).toFixed(3)+" MHz in radio form. Apply configuration before receiving.";
 });
 get("spectrum-export").addEventListener("click",()=>{
  const csv=spectrumCsv(samples,{...lastSettings,baseline_frequencies:baseline.length,baseline_captured:baselineSettings?"yes":"no"},baseline);
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"})),a=document.createElement("a");
  a.href=url;a.download="rfcat-spectrum.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 get("spectrum-clear-baseline").addEventListener("click",()=>{if(controller)return;baseline=[];baselineSettings=null;get("spectrum-clear-baseline").disabled=true;status.textContent="Baseline cleared.";render();});
 async function run(captureBaseline){
  if(controller)return;
  if(isBusy()){status.textContent="Stop active receiving or chat before scanning.";return;}
  const current=settings();
  if(!captureBaseline&&baseline.length&&scanKey(current)!==scanKey(baselineSettings)){status.textContent="Scan range/step differs from baseline. Recapture baseline or clear it first.";return;}
  controller=new AbortController();start.disabled=true;baseButton.disabled=true;stop.disabled=false;samples=[];render();get("spectrum-export").disabled=true;
  try{
   const result=await sweepSpectrum(radio,{...current,signal:controller.signal,onSample:(sample,count,total)=>{samples.push(sample);status.textContent=(captureBaseline?"Capturing baseline ":"Scanning signal ")+count+"/"+total;render();}});
   if(captureBaseline){if(!result.cancelled&&samples.length){baseline=summarizeSpectrum(samples);baselineSettings=current;get("spectrum-clear-baseline").disabled=false;status.textContent="Baseline captured: "+baseline.length+" frequencies. Transmit and scan signal.";samples=[];}else status.textContent="Baseline capture cancelled; previous baseline retained.";}
   else{lastSettings=current;status.textContent=result.cancelled?"Scan cancelled; radio configuration restored.":"Scan complete: "+samples.length+" samples; radio left idle.";}
  }catch(e){status.textContent="Scan error: "+e.message;}
  finally{controller=null;start.disabled=false;baseButton.disabled=false;stop.disabled=true;get("spectrum-export").disabled=!samples.length;render();}
 }
 start.addEventListener("click",()=>run(false));baseButton.addEventListener("click",()=>run(true));
 stop.addEventListener("click",()=>{if(!controller)return;controller.abort();stop.disabled=true;status.textContent="Stopping scan; restoring radio configuration…";});
}
