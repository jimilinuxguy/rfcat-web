import test from "node:test";
import assert from "node:assert/strict";
import {scanReceiverPresets} from "../js/rx/signal-scan.js";
test("scanner rejects unsupported bands and invalid dwell before touching hardware",async()=>{
 const d={device:{opened:true},config:()=>{throw Error("should not read");}};
 await assert.rejects(scanReceiverPresets(d,{frequencyHz:500e6}),/Frequency/);
 await assert.rejects(scanReceiverPresets(d,{frequencyHz:433920000,dwellMs:50}),/Dwell/);
});
test("scanner restores config and labels bytes as packet evidence",async()=>{
 const calls=[];
 const listeners=new Map();
 const d={device:{opened:true},
   config:async()=>({raw:new Uint8Array(0x3e).fill(0)}),
   mode:async v=>calls.push(["mode",v]),
   setFrequency:async v=>calls.push(["frequency",v]),
   setModulation:async v=>calls.push(["modulation",v]),
   setDataRate:async v=>calls.push(["rate",v]),
   setBandwidth:async v=>calls.push(["bandwidth",v]),
   lowball:async()=>calls.push(["lowball"]),
   poke:async (addr,data)=>calls.push(["poke",addr,data[0]]),
   addEventListener:(name,fn)=>listeners.set(name,fn),
   removeEventListener:name=>listeners.delete(name)
 };
 const result=await scanReceiverPresets(d,{frequencyHz:433920000,dwellMs:100,presets:[{name:"test",modulation:48,rate:4800,bandwidth:101562.5}]});
 assert.equal(result.results.length,1);
 assert.equal(result.results[0].evidenceType,"cc1111-packet-bytes");
 assert.equal(result.results[0].modulationVerified,false);
 assert.equal(result.restored,true);
 assert.equal(listeners.size,0);
 assert.ok(calls.some(v=>v[0]==="poke"));
});
