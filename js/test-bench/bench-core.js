// Pure RF test-bench helpers. No hardware access.
export function parseHexPayload(input){
 if(typeof input!=="string")throw new Error("Payload must be text");
 const compact=input.replace(/[\s:_-]/g,"");
 if(!compact||compact.length%2||!/^[0-9a-f]+$/i.test(compact))throw new Error("Enter complete hexadecimal bytes");
 if(compact.length>510)throw new Error("Maximum 255 bytes per packet");
 return Uint8Array.from(compact.match(/../g),s=>parseInt(s,16));
}
export function planBench({payload,repeat=1,intervalMs=250}){
 const bytes=parseHexPayload(payload);
 if(!Number.isInteger(repeat)||repeat<1||repeat>20)throw new Error("Repeat count must be 1–20");
 if(!Number.isInteger(intervalMs)||intervalMs<100||intervalMs>10000)throw new Error("Interval must be 100–10000 ms");
 return Object.freeze({hex:Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join(""),length:bytes.length,repeat,intervalMs,estimatedMinimumMs:(repeat-1)*intervalMs});
}
export function compareBenchPacket(expectedHex,received){
 const expected=parseHexPayload(expectedHex);
 if(!(received instanceof Uint8Array))throw new Error("Received packet must be bytes");
 const differences=[];
 for(let i=0;i<Math.max(expected.length,received.length);i++)if(expected[i]!==received[i])differences.push(i);
 return {match:differences.length===0,expectedLength:expected.length,receivedLength:received.length,differences};
}
export async function executeBench(plan,{transmit,wait,signal,onProgress}){
 if(!plan||typeof transmit!=="function"||typeof wait!=="function")throw new Error("Invalid test bench execution");
 const bytes=parseHexPayload(plan.hex);
 // Revalidate caller-provided plans, even if not produced by planBench.
 const validated=planBench({payload:plan.hex,repeat:plan.repeat,intervalMs:plan.intervalMs});
 const results=[];
 for(let i=0;i<validated.repeat;i++){
  if(signal?.aborted)break;
  if(i>0){await wait(validated.intervalMs,signal);if(signal?.aborted)break;}
  try{
   const reply=await transmit(bytes.slice());
   results.push({index:i+1,ok:true,reply:reply??null});
  }catch(error){results.push({index:i+1,ok:false,error:String(error?.message??error)});onProgress?.(results.at(-1));break;}
  onProgress?.(results.at(-1));
 }
 return {planned:validated.repeat,completed:results.length,cancelled:!!signal?.aborted,results};
}
export function waitBench(ms,signal){
 return new Promise(resolve=>{
  if(signal?.aborted){resolve();return;}
  const done=()=>{clearTimeout(timer);signal?.removeEventListener("abort",done);resolve();};
  const timer=setTimeout(done,ms);
  signal?.addEventListener("abort",done,{once:true});
 });
}
