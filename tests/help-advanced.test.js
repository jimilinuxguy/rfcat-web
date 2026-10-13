import test from "node:test";
import assert from "node:assert/strict";
import {placeHelpCard} from "../js/help/tour-position.js";
import {diagnoseReceiver} from "../js/help/diagnostics.js";
test("anchored card remains in viewport",()=>{
 for(const rect of [{left:10,right:100,top:10,bottom:40},{left:850,right:950,top:650,bottom:680}]){
  const p=placeHelpCard(rect,300,220,1000,700);
  assert.ok(p.left>=12&&p.left<=688);
  assert.ok(p.top>=12&&p.top<=468);
 }
});
test("diagnostics distinguish missing device from missing packet evidence",()=>{
 assert.match(diagnoseReceiver({connected:false,frequencyMHz:433.92,receiving:false})[0],/Connect/);
 assert.ok(diagnoseReceiver({connected:true,frequencyMHz:433.92,receiving:true,packets:0}).some(s=>s.includes("framing")));
});
