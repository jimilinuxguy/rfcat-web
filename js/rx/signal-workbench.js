// Milestone 4: pure, deterministic timing and comparison helpers.
export function timingHistogram(durations,{maxBins=24}={}){
 if(!Array.isArray(durations)||!durations.length||durations.some(v=>!Number.isSafeInteger(v)||v===0))throw Error("Invalid durations");
 const groups={high:[],low:[]};
 durations.forEach((d,index)=>groups[d>0?"high":"low"].push({durationUs:Math.abs(d),index}));
 return Object.fromEntries(Object.entries(groups).map(([level,items])=>{
  const sorted=[...items].sort((a,b)=>a.durationUs-b.durationUs);
  const min=sorted[0]?.durationUs??0,max=sorted.at(-1)?.durationUs??0;
  const width=Math.max(1,Math.ceil((max-min+1)/Math.max(1,maxBins)));
  const bins=new Map();
  for(const item of items){
   const start=min+Math.floor((item.durationUs-min)/width)*width;
   if(!bins.has(start))bins.set(start,{startUs:start,endUs:start+width-1,count:0,indices:[]});
   const bin=bins.get(start);bin.count++;bin.indices.push(item.index);
  }
  return [...bins.values()].sort((a,b)=>a.startUs-b.startUs);
 }));
}
export function compareAlignedCaptures(captures,{maxFrames=12}={}){
 if(!Array.isArray(captures)||captures.length<2)throw Error("At least two captures required");
 const frames=captures.slice(0,maxFrames).map(frame=>{
  if(!Array.isArray(frame)||frame.some(n=>!Number.isSafeInteger(n)||n===0))throw Error("Invalid frame");
  return frame;
 });
 const minLength=Math.min(...frames.map(f=>f.length));
 const positions=[];
 for(let i=0;i<minLength;i++){
  const values=frames.map(f=>f[i]);
  positions.push({index:i,stable:values.every(v=>v===values[0]),values});
 }
 return {framesCompared:frames.length,comparedPulses:minLength,lengths:frames.map(f=>f.length),positions,stableCount:positions.filter(p=>p.stable).length,warning:"Index alignment is heuristic; insertions, missing edges and drift can invalidate comparisons."};
}
export function pulseRange(durations,indices){
 if(!indices.length)return null;
 const wanted=new Set(indices);let t=0,min=Infinity,max=-Infinity;
 durations.forEach((d,i)=>{const start=t;t+=Math.abs(d);if(wanted.has(i)){min=Math.min(min,start);max=Math.max(max,t);}});
 return Number.isFinite(min)?{startUs:min,endUs:max}:null;
}
