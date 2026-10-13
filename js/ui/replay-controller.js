import {prepareReplay,replaySummary,replayAt} from "../rx/session-replay.js";
import {replayDelays,compareReplaySessions} from "../rx/replay-analysis.js";
import {installReplayExport} from "./replay-export.js";

export function initReplayController({getCaptures,listSessions,getSession}){
 const $=id=>document.getElementById(id);
// M11: read-only offline replay of captures already loaded into the session.
const replayHost=document.createElement("section");
replayHost.id="session-replay";
replayHost.setAttribute("aria-label","Offline capture replay");
replayHost.innerHTML='<h3>Offline capture replay</h3><p>Inspect saved or imported captures without transmitting RF.</p><button type="button" id="replay-load">Prepare replay</button> <button type="button" id="replay-prev" disabled>Previous</button> <button type="button" id="replay-next" disabled>Next</button> <button type="button" id="replay-play" disabled>Play</button> <button type="button" id="replay-pause" disabled>Pause</button> <label>Speed <select id="replay-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><output id="replay-summary" aria-live="polite">No replay prepared.</output><pre id="replay-frame"></pre><div id="replay-timeline" aria-label="Capture timeline"></div><div><label>Compare with session <select id="replay-compare-session"></select></label> <button type="button" id="replay-compare">Compare sessions</button></div><pre id="replay-comparison"></pre>';
$("session-save").parentElement?.append(replayHost);
let replayFrames=[],replayIndex=0,replayTimer=null,replayComparison=null;
function pauseReplay(){clearTimeout(replayTimer);replayTimer=null;$("replay-pause").disabled=true;$("replay-play").disabled=!replayFrames.length||replayIndex>=replayFrames.length-1;}
function showReplay(){
 const frame=replayAt(replayFrames,replayIndex);
 $("replay-prev").disabled=!frame||replayIndex===0;
 $("replay-next").disabled=!frame||replayIndex===replayFrames.length-1;
 $("replay-play").disabled=!!replayTimer||!frame||replayIndex===replayFrames.length-1;
 $("replay-frame").textContent=frame?`Capture ${frame.index+1}/${replayFrames.length} · ${frame.bytes.length} bytes · ${frame.timestampMs===null?"No timestamp":new Date(frame.timestampMs).toISOString()}\n${frame.hex}`:"";
}
function resetReplay(){
 pauseReplay();
 replayFrames=[];replayIndex=0;
 $("replay-summary").textContent="No replay prepared.";
 $("replay-timeline").replaceChildren();
 $("replay-comparison").textContent="";
 replayComparison=null;
 showReplay();
}
$("replay-load").onclick=()=>{
 try{
  pauseReplay();
  replayFrames=prepareReplay(getCaptures());replayIndex=0;replayComparison=null;$("replay-comparison").textContent="";
  void refreshReplayComparisonOptions();
  const stats=replaySummary(replayFrames);
  $("replay-summary").textContent=`${stats.count} captures · ${stats.uniquePayloads} unique payloads · ${stats.duplicates} repeated · ${stats.totalBytes} total bytes`;
  const timeline=$("replay-timeline");timeline.replaceChildren();
  for(const frame of replayFrames.slice(0,300)){const button=document.createElement("button");button.type="button";button.className="replay-marker";button.textContent=String(frame.index+1);button.title=frame.hex;button.onclick=()=>{pauseReplay();replayIndex=frame.index;showReplay();};timeline.append(button);}
  showReplay();
 }catch(error){resetReplay();$("replay-summary").textContent=`Replay error: ${error.message}`;}
};
$("replay-prev").onclick=()=>{pauseReplay();if(replayIndex>0){replayIndex--;showReplay();}};
$("replay-next").onclick=()=>{pauseReplay();if(replayIndex<replayFrames.length-1){replayIndex++;showReplay();}};
$("replay-pause").onclick=pauseReplay;
$("replay-play").onclick=()=>{
 if(replayTimer||!replayFrames.length||replayIndex>=replayFrames.length-1)return;
 const delays=replayDelays(replayFrames,{speed:Number($("replay-speed").value)});
 $("replay-pause").disabled=false;$("replay-play").disabled=true;
 const tick=()=>{
  if(replayIndex>=replayFrames.length-1){pauseReplay();return;}
  replayIndex++;showReplay();
  if(replayIndex>=replayFrames.length-1){pauseReplay();return;}
  replayTimer=setTimeout(tick,delays[replayIndex+1]);
 };
 replayTimer=setTimeout(tick,delays[replayIndex+1]);
};
async function refreshReplayComparisonOptions(){
 const select=$("replay-compare-session");select.replaceChildren();
 for(const session of await listSessions()){const option=document.createElement("option");option.value=session.id;option.textContent=session.name;select.append(option);}
}
$("replay-compare").onclick=async()=>{
 try{
  const id=$("replay-compare-session").value;
  if(!id)throw new Error("Select a saved session");
  const session=await getSession(id);
  if(!session)throw new Error("Session not found");
  const other=prepareReplay(session.captures??[]);
  const diff=compareReplaySessions(replayFrames,other);
  replayComparison={sessionId:session.id,sessionName:session.name,rows:diff};
  $("replay-comparison").textContent=diff.length?diff.slice(0,200).map(row=>`${row.hex}: current ${row.left} · selected ${row.right} · Δ ${row.delta>=0?"+":""}${row.delta}`).join("\n"):"No payloads to compare";
 }catch(error){replayComparison=null;$("replay-comparison").textContent=`Comparison error: ${error.message}`;}
};
installReplayExport({host:replayHost,getFrames:()=>replayFrames,getComparison:()=>replayComparison,getSummary:replaySummary,onEmpty:()=>{$("replay-summary").textContent="Prepare a non-empty replay before exporting.";}});
void refreshReplayComparisonOptions();
document.addEventListener("rfcat:replay-reset",resetReplay);

}
