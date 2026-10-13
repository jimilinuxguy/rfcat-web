// M11 offline replay: deterministic capture inspection; never talks to USB or TX.
function bytesOf(item){
 const raw=item?.bytes??item?.data??item?.hex;
 if(raw instanceof Uint8Array)return [...raw];
 if(Array.isArray(raw)&&raw.every(n=>Number.isInteger(n)&&n>=0&&n<=255))return [...raw];
 if(typeof raw==="string"){
  const clean=raw.replace(/(?:0x)/gi,"").replace(/[\s,:-]/g,"");
  if(clean.length%2===0&&/^[0-9a-f]*$/i.test(clean))return clean.match(/../g)?.map(x=>parseInt(x,16))??[];
 }
 throw new TypeError("Capture has invalid bytes");
}
export function prepareReplay(captures,{maxCaptures=10000}={}){
 if(!Array.isArray(captures)||captures.length>maxCaptures)throw new RangeError("Invalid capture count");
 return captures.map((item,index)=>{
  const bytes=bytesOf(item);
  if(!bytes.length||bytes.length>4096)throw new RangeError("Invalid capture length at "+index);
  const timestamp=item.timestamp??item.timestampMs??null;
  const parsed=timestamp===null?null:typeof timestamp==="number"?timestamp:Date.parse(timestamp);
  const timestampMs=Number.isFinite(parsed)&&parsed>=0?parsed:null;
  return Object.freeze({index,bytes:Object.freeze(bytes),hex:bytes.map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase(),timestampMs,decoder:item.decoder??null,rssi:Number.isFinite(Number(item.rssi))&&item.rssi!=null?Number(item.rssi):null});
 });
}
export function replaySummary(frames){
 const unique=new Set(frames.map(f=>f.hex));
 const times=frames.map(f=>f.timestampMs).filter(t=>t!==null);
 const lengths=frames.map(f=>f.bytes.length);
 return {count:frames.length,uniquePayloads:unique.size,duplicates:frames.length-unique.size,totalBytes:lengths.reduce((a,b)=>a+b,0),minBytes:lengths.length?Math.min(...lengths):0,maxBytes:lengths.length?Math.max(...lengths):0,firstTimestampMs:times.length?Math.min(...times):null,lastTimestampMs:times.length?Math.max(...times):null};
}
export function replayAt(frames,index){
 if(!Number.isInteger(index)||index<0||index>=frames.length)return null;
 return frames[index];
}
