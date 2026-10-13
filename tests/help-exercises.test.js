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
