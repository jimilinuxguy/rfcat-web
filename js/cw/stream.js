import {decodeMorseRuns,runsFromRawBytes} from "./morse.js";

// Packet RX often produces a repeated C0 00... idle frame. Never assume
// that C0 is a protocol header: ignore it only when the *entire* frame
// matches the measured idle signature. Preserve active-frame bytes.
export function isIdleOokFrame(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.length)return true;
 if(bytes.every(v=>v===0))return true;
 return bytes[0]===0xc0 && bytes.subarray(1).every(v=>v===0);
}
export function createCwStream({sampleRate=1000,wpm=20,onMessage=()=>{},onStatus=()=>{},maxBytes=4096,idleFramesToFlush=1}={}){
 if(!Number.isFinite(sampleRate)||sampleRate<=0)throw Error("Invalid CW sample rate");
 let pending=[],idleFrames=0,frames=0,activeFrames=0,lastFingerprint="";
 const status=()=>({frames,activeFrames,bufferedBytes:pending.length,idleFrames});
 function flush(reason="idle"){
  if(!pending.length)return null;
  const bytes=Uint8Array.from(pending);pending=[];idleFrames=0;
  const runs=runsFromRawBytes(bytes,sampleRate);
  // Remove leading and trailing silence. Long idle prefixes are not a
  // Morse character and must not bias automatic timing.
  while(runs.length&&runs[0].level===0)runs.shift();
  while(runs.length&&runs.at(-1).level===0)runs.pop();
  if(!runs.some(r=>r.level===1))return null;
  const result=decodeMorseRuns(runs,{wpm});
  const fingerprint=bytes.length+":"+result.code+":"+result.text;
  if(result.marks>=2 && result.confidence>=0.65 && result.text.replace(/�/g,"").length>0){
   if(fingerprint!==lastFingerprint){
    lastFingerprint=fingerprint;
    onMessage({...result,reason,frames:activeFrames,bytes:bytes.length});
   }
  }else onStatus({...status(),reason:"low-confidence",candidate:result.text,confidence:result.confidence});
  return result;
 }
 return {
  push(bytes){
   if(!(bytes instanceof Uint8Array))throw new TypeError("Expected Uint8Array");
   frames++;
   if(isIdleOokFrame(bytes)){
    idleFrames++;
    if(idleFrames>=idleFramesToFlush)flush("idle-frame");
    onStatus({...status(),reason:"idle"});
    return;
   }
   idleFrames=0;activeFrames++;
   // Preserve sample order across CC1111 packet boundaries. Do not
   // independently decode each fixed-length packet.
   for(const byte of bytes)pending.push(byte);
   if(pending.length>=maxBytes)flush("buffer-limit");
   onStatus({...status(),reason:"active"});
  },
  flush,
  reset(){pending=[];idleFrames=0;frames=0;activeFrames=0;lastFingerprint="";onStatus({...status(),reason:"reset"});},
  status
 };
}
