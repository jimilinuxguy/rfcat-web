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
 const selectors=[...HELP_TOPICS.map(t=>t.target),...TOURS.flatMap(t=>t.steps.map(s=>s.target))];
 for(const selector of selectors){
  const name=selector.slice(1);
  const exists=selector[0]==="#"
   ? [...html.matchAll(/\bid="([^"]+)"/g)].some(m=>m[1]===name)
   : [...html.matchAll(/\bclass="([^"]+)"/g)].some(m=>m[1].split(/\s+/).includes(name));
  assert.ok(exists||(selector.startsWith("#replay-")&&dynamic.includes(`id="${name}"`)),"Missing help target: "+selector);
 }
});
