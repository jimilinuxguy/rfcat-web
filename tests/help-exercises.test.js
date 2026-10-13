import test from "node:test";
import assert from "node:assert/strict";
import {EXERCISES,checkExercise} from "../js/help/exercises.js";
import {TOURS} from "../js/help/tours.js";
test("advanced tutorials provide grounded exercises",()=>{
 const advanced=TOURS.filter(t=>t.steps.some(s=>s.exercise));
 assert.equal(advanced.length,5);
 for(const tour of advanced){
  assert.ok(tour.steps.length>=3);
  assert.ok(tour.steps.some(s=>s.exercise));
  for(const step of tour.steps)if(step.exercise)assert.ok(EXERCISES[step.exercise]);
 }
});
test("practice questions validate without side effects",()=>{
 for(const [id,exercise] of Object.entries(EXERCISES)){
  assert.equal(checkExercise(id,exercise.correct).correct,true);
  assert.equal(checkExercise(id,(exercise.correct+1)%exercise.options.length).correct,false);
  assert.ok(checkExercise(id,exercise.correct).explanation.length>20);
 }
 assert.equal(checkExercise("unknown",0),null);
});

test("M6 burst grouping wizard provides grounded, non-transmitting steps",async()=>{
 const {ONBOARDING_GOALS}=await import("../js/help/onboarding.js");
 const {HELP_TOPICS}=await import("../js/help/tours.js");
 assert.ok(ONBOARDING_GOALS.includes("intelligent-receiver"));
 const tour=TOURS.find(t=>t.id==="intelligent-receiver");
 assert.equal(tour.steps.length,8);
 for(const selector of ["#rx-burst-enabled","#rx-burst-window","#listen","#rx-burst-summary","#rx-burst-list","#rx-burst-export"]){
  assert.ok(tour.steps.some(s=>s.target===selector),selector);
 }
 assert.ok(HELP_TOPICS.some(t=>t.target==="#rx-burst-window"&&t.doc==="docs/capture-pipeline.md"));
 assert.ok(tour.steps.every(s=>!s.advanceOn||s.advanceOn==="connected"));
});
