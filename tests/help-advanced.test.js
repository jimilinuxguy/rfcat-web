import test from "node:test";
import assert from "node:assert/strict";
import {placeHelpCard} from "../js/help/tour-position.js";
import {diagnoseReceiver,analyzeRadioState,readRadioDiagnostics} from "../js/help/diagnostics.js";
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

test("diagnostics prioritize connection and frequency without changing settings",()=>{
 const issues=analyzeRadioState({connected:false,frequencyMHz:100,receiving:false});
 assert.deepEqual(issues.map(i=>i.id),["connection","frequency"]);
 assert.equal(issues[0].target,"#connect");
});
test("diagnostics distinguish no packets from decoder failures and filters",()=>{
 const noPackets=analyzeRadioState({connected:true,frequencyMHz:433.92,receiving:true,packets:0});
 assert.ok(noPackets.some(i=>i.id==="no-packets"));
 const undecoded=analyzeRadioState({connected:true,frequencyMHz:433.92,receiving:true,packets:3,decoded:0,rejected:2,duplicates:1,filter:"decoded"});
 assert.deepEqual(undecoded.map(i=>i.id),["decode","rejected","duplicates","hidden"]);
});
test("healthy diagnostics never claim verified RF reception",()=>{
 const issues=analyzeRadioState({connected:true,frequencyMHz:433.92,receiving:true,packets:2,decoded:2,rejected:0,duplicates:0});
 assert.equal(issues[0].id,"healthy");
 assert.match(issues[0].detail,/does not verify/);
});
test("DOM reader parses status, counters and filter without side effects",()=>{
 const entries={status:{textContent:"Connected"},rxstate:{textContent:"RX"},freq:{value:"433.920"},packets:{textContent:"4"}, "rx-decoded":{textContent:"2"},"rx-rejected":{textContent:"1"},"rx-duplicates":{textContent:"0"},"rx-filter":{value:"decoded"}};
 const snapshot=readRadioDiagnostics({body:{classList:{contains:()=>false}},getElementById:id=>entries[id]??null});
 assert.equal(snapshot.connected,true);assert.equal(snapshot.receiving,true);assert.equal(snapshot.packets,4);assert.equal(snapshot.filter,"decoded");
});
