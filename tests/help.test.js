import test from "node:test";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {TOURS,HELP_TOPICS,findTour} from "../js/help/tours.js";
import {onboardingCopy,ONBOARDING_GOALS} from "../js/help/onboarding.js";
import {RFCAT_DB_VERSION,RFCAT_DB_STORES} from "../js/storage/db.js";
test("guided tours have unique IDs and useful steps",()=>{
 assert.equal(new Set(TOURS.map(t=>t.id)).size,TOURS.length);
 for(const tour of TOURS){assert.ok(tour.title);assert.ok(tour.steps.length>=2);for(const step of tour.steps){assert.ok(step.target.startsWith("#")||step.target.startsWith("."));assert.ok(step.title&&step.text);}}
 assert.equal(findTour("missing"),null);
 assert.equal(findTour("analyze").id,"analyze");
});
test("onboarding offers all workflows and four steps",()=>{
 assert.ok(ONBOARDING_GOALS.every(id=>findTour(id)));
 for(let i=0;i<4;i++)assert.ok(onboardingCopy(i)?.title);
 assert.equal(onboardingCopy(4),null);
});
test("help topics have documentation and persistent store version",()=>{
 for(const topic of HELP_TOPICS){assert.ok(topic.doc.startsWith("docs/"));assert.ok(topic.target&&topic.text);}
 assert.ok(RFCAT_DB_VERSION>=4);assert.ok(RFCAT_DB_STORES.includes("help"));
});

test("every contextual help and tutorial selector exists in index.html",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const dynamic=readFileSync(new URL("../js/ui/replay-controller.js",import.meta.url),"utf8");
 const spectrum=readFileSync(new URL("../js/ui/spectrum-explorer.js",import.meta.url),"utf8");
 const intelligence=readFileSync(new URL("../js/ui/signal-intelligence.js",import.meta.url),"utf8");
 const protocolUi=["protocol-definition-builder.js","protocol-decoder-workbench.js","protocol-timeline.js","protocol-state-machine.js","protocol-investigation.js","protocol-evidence-workbench.js","protocol-discovery-workbench.js","protocol-offline-lab.js","visual-field-editor.js"].map(file=>readFileSync(new URL("../js/ui/"+file,import.meta.url),"utf8")).join("\n");
 const selectors=[...HELP_TOPICS.map(t=>t.target),...TOURS.flatMap(t=>t.steps.map(s=>s.target))];
 for(const selector of selectors){
  const name=selector.slice(1);
  const exists=selector[0]==="#"
   ? [...html.matchAll(/\bid="([^"]+)"/g)].some(m=>m[1]===name)
   : [...html.matchAll(/\bclass="([^"]+)"/g)].some(m=>m[1].split(/\s+/).includes(name));
  assert.ok(exists||(selector.startsWith("#replay-")&&dynamic.includes(`id="${name}"`))||(selector.startsWith("#spectrum-")&&spectrum.includes(`id="${name}"`))||(selector.startsWith("#intelligence-")&&intelligence.includes(`id="${name}"`))||(selector==="#signal-intelligence"&&intelligence.includes('panel.id="signal-intelligence"'))||(selector.startsWith("#pd-")&&protocolUi.includes(`id="${name}"`)),"Missing help target: "+selector);
 }
});

test("M13–M19 guided workflows cover protocol builder, evidence, regression, decoder, timeline and state inference",()=>{
 for(const id of ["protocol-builder","protocol-evidence","protocol-regression","protocol-decoder","protocol-timeline","protocol-state-machine"]){const tour=findTour(id);assert.ok(tour,id);assert.equal(tour.category,"Protocol analysis");assert.ok(tour.steps.length>=4);assert.ok(tour.steps.every(step=>step.workspace==="analyze"));}
 assert.ok(HELP_TOPICS.some(topic=>topic.target==="#pd-sm-run"));
});

test("M21 and M22 tours cover the investigation lifecycle and visualization guides",()=>{
 for(const id of ["investigation-workflow","investigation-resume","investigation-field-diagram","investigation-timeline-chart","investigation-state-graph"]){const tour=findTour(id);assert.ok(tour,id);assert.equal(tour.category,"Protocol analysis");assert.ok(tour.steps.length>=4);assert.ok(tour.steps.every(step=>step.workspace==="analyze"));assert.ok(ONBOARDING_GOALS.includes(id));}
 for(const target of ["#pd-inv-stages","#pd-inv-save","#pd-inv-visual"])assert.ok(HELP_TOPICS.some(topic=>topic.target===target));
});

test("M23/M24 guided help includes all new analysis workflows",()=>{for(const id of ["investigation-hypothesis","investigation-hypothesis-validation","protocol-decoder-sdk"]){const tour=findTour(id);assert.ok(tour);assert.equal(tour.category,"Protocol analysis");assert.ok(tour.steps.length>=4);assert.ok(ONBOARDING_GOALS.includes(id));}assert.ok(HELP_TOPICS.some(t=>t.doc==="docs/investigation-evidence.md"));assert.ok(HELP_TOPICS.some(t=>t.doc==="docs/protocol-decoder-sdk.md"));});

test("M25/M26 wizard topics and onboarding are registered",()=>{for(const id of ["protocol-candidate-discovery","protocol-session-correlation"]){const tour=findTour(id);assert.ok(tour);assert.ok(tour.steps.length>=4);assert.ok(ONBOARDING_GOALS.includes(id));}assert.ok(HELP_TOPICS.some(t=>t.doc==="docs/protocol-discovery-correlation.md"));});

test("M27-M30 four offline lab wizards and Help topics",()=>{for(const id of ["protocol-simulation","protocol-synthetic","protocol-differential","protocol-dashboard"]){const tour=findTour(id);assert.ok(tour);assert.ok(tour.steps.length>=4);assert.ok(ONBOARDING_GOALS.includes(id));}assert.ok(HELP_TOPICS.some(t=>t.doc==="docs/protocol-offline-lab.md"));});
