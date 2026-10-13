// Read-only summary of the current form values; these are not confirmed hardware settings.
export function readRadioSummary(doc){
 const value=id=>doc.getElementById(id)?.value;
 const freq=Number(value("freq"));
 const mod=doc.getElementById("mod");
 const modulation=mod?.selectedOptions?.[0]?.textContent?.trim()||"Unknown";
 const rate=Number(value("drate"));
 const connected=Boolean(doc.body?.classList.contains("connected"));
 return {
  connected,
  frequency:Number.isFinite(freq)&&freq>0?freq.toFixed(3)+" MHz":"—",
  modulation,
  dataRate:Number.isFinite(rate)&&rate>0?rate.toLocaleString("en-US")+" baud":"—"
 };
}
export function formatRadioSummary(summary){
 return [summary.frequency,summary.modulation,summary.dataRate].join(" · ");
}
export function initRadioStatus(doc=document){
 const button=doc.getElementById("radio-status-shortcut");
 if(!button)return()=>{};
 const detail=doc.getElementById("radio-status-details");
 const connection=doc.getElementById("radio-status-connection");
 const update=()=>{
  const state=readRadioSummary(doc);
  if(detail)detail.textContent=formatRadioSummary(state);
  if(connection)connection.textContent=state.connected?"Connected":"Disconnected";
  button.setAttribute("aria-label","Radio form settings: "+formatRadioSummary(state)+". Open Tools to configure.");
 };
 const onInput=event=>{if(["freq","mod","drate"].includes(event.target?.id))update();};
 const observer=typeof MutationObserver!=="undefined"?new MutationObserver(update):null;
 observer?.observe(doc.body,{attributes:true,attributeFilter:["class"]});
 doc.addEventListener("input",onInput);
 doc.addEventListener("change",onInput);
 const openTools=()=>doc.dispatchEvent(new CustomEvent("rfcat:workspace-activate",{detail:{workspace:"tools"}}));
 button.addEventListener("click",openTools);
 update();
 return ()=>{observer?.disconnect();doc.removeEventListener("input",onInput);doc.removeEventListener("change",onInput);button.removeEventListener("click",openTools);};
}
if(typeof document!=="undefined")initRadioStatus();
