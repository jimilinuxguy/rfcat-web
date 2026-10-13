// Offline playback schedule. Relative capture times are clamped so corrupt clocks
// cannot create negative or unbounded waits. No WebUSB or radio dependencies.
export function replayDelays(frames,{speed=1,maxGapMs=3000,fallbackGapMs=250}={}){
 if(!Number.isFinite(speed)||speed<0.25||speed>8)throw new RangeError("Playback speed must be 0.25–8x");
 if(!Number.isFinite(maxGapMs)||maxGapMs<0||maxGapMs>60000)throw new RangeError("Invalid max gap");
 if(!Number.isFinite(fallbackGapMs)||fallbackGapMs<0||fallbackGapMs>60000)throw new RangeError("Invalid fallback gap");
 return frames.map((frame,index)=>{
  if(index===0)return 0;
  const previous=frames[index-1].timestampMs,current=frame.timestampMs;
  const gap=previous!==null&&current!==null&&current>=previous?current-previous:fallbackGapMs;
  return Math.round(Math.min(gap,maxGapMs)/speed);
 });
}
export function compareReplaySessions(left,right){
 const count=new Map();
 for(const frame of left)count.set(frame.hex,(count.get(frame.hex)||0)+1);
 const other=new Map();
 for(const frame of right)other.set(frame.hex,(other.get(frame.hex)||0)+1);
 const keys=[...new Set([...count.keys(),...other.keys()])].sort();
 return keys.map(hex=>({hex,left:count.get(hex)||0,right:other.get(hex)||0,delta:(other.get(hex)||0)-(count.get(hex)||0)}));
}
