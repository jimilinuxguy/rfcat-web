import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORKSPACES,panelWorkspace} from "../js/ui/workspace-navigation.js";
import {workspaceForTarget,revealHelpTarget} from "../js/help/workspace-target.js";

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
