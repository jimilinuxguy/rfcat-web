import {test} from "node:test";
import assert from "node:assert/strict";
import {scanFrequencies,rssiDbm,sweepSpectrum} from "../js/rx/spectrum.js";
test("frequency grid stays within supported bands",()=>{
 assert.deepEqual(scanFrequencies(433,433.2,100),[433000000,433100000,433200000]);
 assert.throws(()=>scanFrequencies(348,387,100),/600|unsupported/);
 assert.throws(()=>scanFrequencies(433,434,0),/Invalid/);
});
test("CC1111 signed RSSI conversion",()=>{
 assert.equal(rssiDbm(0),-74);assert.equal(rssiDbm(128),-138);assert.equal(rssiDbm(200),-102);
});
test("sweep samples and restores registers even when cancelled",async()=>{
 const calls=[],raw=Array.from({length:0x30},(_,i)=>i);
 const device={device:{opened:true},config:async()=>({raw}),mode:async v=>calls.push(["mode",v]),setFrequency:async hz=>calls.push(["freq",hz]),peek:async()=>Uint8Array.of(200),poke:async(a,v)=>calls.push(["poke",a,v[0]])};
 const result=await sweepSpectrum(device,{startMHz:433,stopMHz:433,stepKHz:100,dwellMs:20});
 assert.equal(result.samples.length,1);assert.equal(result.samples[0].rssiDbm,-102);assert.equal(result.restored,true);
 assert.ok(calls.some(x=>x[0]==="poke"));
});

test("repeated sweeps collect multiple passes and stop on abort",async()=>{
 const raw=Array.from({length:0x30},()=>0),controller=new AbortController(),seen=[];
 const device={device:{opened:true},config:async()=>({raw}),mode:async()=>{},setFrequency:async()=>{},peek:async()=>Uint8Array.of(200),poke:async()=>{}};
 const result=await sweepSpectrum(device,{startMHz:433.92,stopMHz:433.92,stepKHz:50,dwellMs:20,passes:20,signal:controller.signal,onSample:sample=>{seen.push(sample);if(seen.length===2)controller.abort();}});
 assert.equal(result.samples.length,2);
 assert.equal(result.cancelled,true);
 assert.equal(result.restored,true);
 assert.throws(()=>scanFrequencies(433.92,433.92,9),/Invalid/);
});
