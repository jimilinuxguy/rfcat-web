import test from "node:test";
import assert from "node:assert/strict";
import {parseHexPayload,planBench,compareBenchPacket,executeBench,waitBench} from "../js/test-bench/bench-core.js";
test("hex parser accepts separators and enforces packet size",()=>{
 assert.deepEqual([...parseHexPayload("AA 55:00_ff")],[170,85,0,255]);
 for(const bad of ["","0","zz","aa0","aa".repeat(256)])assert.throws(()=>parseHexPayload(bad));
});
test("bench plans enforce bounded transmissions",()=>{
 assert.deepEqual(planBench({payload:"ab",repeat:2,intervalMs:250}),{hex:"ab",length:1,repeat:2,intervalMs:250,estimatedMinimumMs:250});
 for(const repeat of [0,21,1.5])assert.throws(()=>planBench({payload:"aa",repeat}));
 for(const intervalMs of [0,99,10001,NaN])assert.throws(()=>planBench({payload:"aa",intervalMs}));
});
test("RX comparison preserves exact mismatch positions and lengths",()=>{
 assert.deepEqual(compareBenchPacket("aabb",Uint8Array.of(0xaa,0xbc)),{match:false,expectedLength:2,receivedLength:2,differences:[1]});
 assert.equal(compareBenchPacket("aabb",Uint8Array.of(0xaa,0xbb)).match,true);
 assert.deepEqual(compareBenchPacket("aa",Uint8Array.of(0xaa,0xbb)).differences,[1]);
});
test("executor sends bounded sequence and reports progress",async()=>{
 const sent=[],progress=[];
 const result=await executeBench(planBench({payload:"aa55",repeat:3,intervalMs:100}),{transmit:async b=>{sent.push([...b]);return 1;},wait:async()=>{},onProgress:r=>progress.push(r.index)});
 assert.deepEqual(sent,[[170,85],[170,85],[170,85]]);
 assert.deepEqual(progress,[1,2,3]);assert.equal(result.completed,3);
});
test("executor stops after failure and honors abort during wait",async()=>{
 let n=0;
 const failed=await executeBench(planBench({payload:"ff",repeat:3}),{transmit:async()=>{n++;throw Error("USB error");},wait:async()=>{}});
 assert.equal(n,1);assert.equal(failed.results[0].ok,false);
 const controller=new AbortController();
 const stopped=await executeBench(planBench({payload:"ff",repeat:3}),{signal:controller.signal,transmit:async()=>{n++;},wait:async()=>controller.abort()});
 assert.equal(stopped.completed,1);assert.equal(stopped.cancelled,true);
 const pre=new AbortController();pre.abort();
 await waitBench(100,pre.signal);
});
