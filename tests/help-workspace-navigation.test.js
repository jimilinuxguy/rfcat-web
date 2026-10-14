import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORKSPACES,panelWorkspace} from "../js/ui/workspace-navigation.js";
import {workspaceForTarget,revealHelpTarget,HELP_TARGET_FALLBACKS} from "../js/help/workspace-target.js";

function makeTarget(id,visible=true){
 const panel={dataset:{workspacePanel:id}};
 return {closest(selector){return selector==="[data-workspace-panel]"?panel:null;},getClientRects(){return visible?[{}]:[];}};
}
function makeDoc(target){
 const events=[];
 return {events,querySelector(){return target;},dispatchEvent(event){events.push(event);}};
}
test("guided help resolves each workspace from the existing panel registry",()=>{
 for(const [panel,workspace] of [["radio","tools"],["receiver","receive"],["capture-library","receive"],["transmitter","transmit"],["test-bench","transmit"],["signal-analyzer","analyze"],["pulse-analyzer","analyze"],["cw","protocols"],["momentum-chat","protocols"]]){
  const doc=makeDoc(makeTarget(panel));
  assert.equal(workspaceForTarget("#target",doc),workspace);
  assert.ok(WORKSPACES.includes(workspace));
 }
});
test("tour targets activate the owning tab and do not navigate shared controls",()=>{
 const target=makeTarget("cw"),doc=makeDoc(target);
 assert.equal(revealHelpTarget("#cw-message",doc),target);
 assert.equal(doc.events.length,1);
 assert.equal(doc.events[0].type,"rfcat:workspace-activate");
 assert.equal(doc.events[0].detail.workspace,"protocols");
 const shared=makeDoc(makeTarget("activity"));
 revealHelpTarget("#log",shared);
 assert.equal(shared.events.length,0);
});
test("unavailable or hidden targets cannot be highlighted",()=>{
 assert.equal(revealHelpTarget("#missing",makeDoc(null)),null);
 assert.equal(revealHelpTarget("#hidden",makeDoc(makeTarget("radio",false))),null);
});
test("tutorial and diagnostic code use the same workspace reveal helper",()=>{
 for(const file of ["tour-engine.js","help-center.js"]){
  const source=readFileSync(new URL("../js/help/"+file,import.meta.url),"utf8");
  assert.match(source,/revealHelpTarget/);
 }
 assert.equal(panelWorkspace("activity"),"shared");
});

test("every connection-led tutorial declares its starting workspace",async()=>{
 const {TOURS}=await import("../js/help/tours.js");
 const allowed=new Set(WORKSPACES);
 for(const tour of TOURS){
  const first=tour.steps[0];
  if(first.target==="#connect"){
   assert.ok(allowed.has(first.workspace),tour.id+" must activate a workspace before connection");
  }
 }
});
test("tour target selectors exist in the page markup",async()=>{
 const {TOURS}=await import("../js/help/tours.js");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const dynamic=readFileSync(new URL("../js/ui/replay-controller.js",import.meta.url),"utf8");
 const spectrum=readFileSync(new URL("../js/ui/spectrum-explorer.js",import.meta.url),"utf8");
 const intelligence=readFileSync(new URL("../js/ui/signal-intelligence.js",import.meta.url),"utf8");
 const protocolUi=["protocol-definition-builder.js","protocol-decoder-workbench.js","protocol-timeline.js","protocol-state-machine.js"].map(file=>readFileSync(new URL("../js/ui/"+file,import.meta.url),"utf8")).join("\n");
 for(const tour of TOURS)for(const step of tour.steps){
  if(step.target.startsWith("#"))assert.ok(html.includes('id="'+step.target.slice(1)+'"')||(step.target.startsWith("#replay-")&&dynamic.includes('id="'+step.target.slice(1)+'"'))||(step.target.startsWith("#spectrum-")&&spectrum.includes('id="'+step.target.slice(1)+'"'))||(step.target.startsWith("#intelligence-")&&intelligence.includes('id="'+step.target.slice(1)+'"'))||(step.target==="#signal-intelligence"&&intelligence.includes('panel.id="signal-intelligence"'))||(step.target.startsWith("#pd-")&&protocolUi.includes('id="'+step.target.slice(1)+'"')),tour.id+": "+step.target);
  else if(step.target.startsWith("."))assert.ok(html.includes(step.target.slice(1)),tour.id+": "+step.target);
 }
});
test("Momentum tutorial targets its chat panel rather than transmitter protocol selector",async()=>{
 const {TOURS}=await import("../js/help/tours.js");
 assert.ok(TOURS.find(t=>t.id==="momentum").steps.some(step=>step.target===".momentum-chat-card"));
});

test("inactive analysis targets fall back to visible launchers",()=>{
 for(const [selector,launcher] of Object.entries(HELP_TARGET_FALLBACKS)){
  const hidden=makeTarget("receiver",false);
  const visible=makeTarget("receiver",true);
  const doc={events:[],querySelector(value){return value===selector?hidden:value===launcher?visible:null;},dispatchEvent(event){this.events.push(event);}};
  assert.equal(revealHelpTarget(selector,doc),visible,selector+" should use "+launcher);
  assert.equal(doc.events.at(-1).detail.workspace,"receive");
 }
});
