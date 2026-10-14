import {C} from "../rfcat/constants.js";
import {R} from "../radio/registers.js";
export const BANDS=[[300,348],[387,464],[779,928]];
export function scanFrequencies(startMHz,stopMHz,stepKHz){
 if(![startMHz,stopMHz,stepKHz].every(Number.isFinite)||stepKHz<10||stepKHz>1000||stopMHz<startMHz)throw Error("Invalid scan range or step (10–1000 kHz)");
 const count=Math.floor((stopMHz-startMHz)*1000/stepKHz+1e-7)+1;
 if(count<1||count>600)throw Error("Scan must contain 1–600 frequencies");
 const points=Array.from({length:count},(_,i)=>Math.round((startMHz+i*stepKHz/1000)*1e6));
 if(points.some(hz=>!BANDS.some(([lo,hi])=>hz>=lo*1e6&&hz<=hi*1e6)))throw Error("Scan crosses an unsupported CC1111 frequency band");
 return points;
}
export function rssiDbm(raw){if(!Number.isInteger(raw)||raw<0||raw>255)throw Error("Invalid RSSI register");return (raw>=128?raw-256:raw)/2-74;}
export async function sweepSpectrum(device,{startMHz,stopMHz,stepKHz=100,dwellMs=40,signal,onSample=()=>{}}){
 if(!device?.device?.opened)throw Error("Connect YARD Stick One first");
 if(!Number.isInteger(dwellMs)||dwellMs<20||dwellMs>2000)throw Error("Dwell must be 20–2000 ms");
 const frequencies=scanFrequencies(startMHz,stopMHz,stepKHz);
 const original=await device.config(),results=[];
 const wait=ms=>new Promise(resolve=>{const timer=setTimeout(done,ms);function done(){clearTimeout(timer);signal?.removeEventListener("abort",done);}signal?.addEventListener("abort",done,{once:true});});
 try{
  for(const hz of frequencies){
   if(signal?.aborted)break;
   await device.mode(C.RF_IDLE);
   await device.setFrequency(hz);
   await device.mode(C.RF_RX);
   await wait(dwellMs);
   if(signal?.aborted)break;
   const bytes=await device.peek(R.RSSI,1);
   const sample={frequencyHz:hz,rssiDbm:rssiDbm(bytes[0]),timestamp:Date.now()};
   results.push(sample);onSample(sample,results.length,frequencies.length);
  }
 }finally{
  try{
   await device.mode(C.RF_IDLE);
   const writable=[0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0a,0x0b,0x0c,0x0d,0x0e,0x0f,0x10,0x11,0x12,0x13,0x14,0x15,0x16,0x17,0x18,0x19,0x1a,0x1b,0x1c,0x1d,0x1e,0x1f,0x20,0x21,0x23,0x24,0x25,0x26,0x27,0x28,0x29,0x2a,0x2b,0x2c];
   for(const offset of writable)await device.poke(R.SYNC1+offset,new Uint8Array([original.raw[offset]]));
   await device.poke(R.PA_TABLE0,new Uint8Array([original.raw[0x2e]]));
  }catch(e){throw Error("Spectrum scan radio restore failed: "+e.message);}
 }
 return {samples:results,cancelled:!!signal?.aborted,restored:true};
}
