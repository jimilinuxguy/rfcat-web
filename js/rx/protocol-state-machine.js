import {analyzeProtocolTimeline} from "./protocol-timeline.js";
export function inferProtocolStateMachine(definition,captures,{fieldName=null,includeInvalidChecksums=false}={}){
 const timeline=analyzeProtocolTimeline(definition,captures);
 const candidates=timeline.fields.filter(field=>field.type==="enum"||field.type==="bits"||field.type==="uint"||field.type==="hex");
 const selected=fieldName?candidates.find(field=>field.name===fieldName):candidates.find(field=>field.type==="enum")??candidates.find(field=>field.type==="bits")??candidates.find(field=>field.type==="uint"&&!field.incrementing)??candidates[0];
 if(!selected)throw Error("No suitable decoded state field found");
 if(fieldName&&!candidates.some(field=>field.name===fieldName))throw Error("Unknown state field");
 const observations=timeline.events.filter(event=>event.matched&&(includeInvalidChecksums||event.checksumsValid!==false)).map(event=>{
  const decoded=event.fields.find(field=>field.name===selected.name);
  return decoded?{index:event.index,time:event.time,value:String(decoded.value),label:String(decoded.label??decoded.value)}:null;
 }).filter(Boolean);
 const nodes=new Map(),edges=new Map(),runs=[];
 let previous=null;
 for(const current of observations){
  const node=nodes.get(current.value)??{id:current.value,label:current.label,count:0,firstIndex:current.index};
  node.count++;nodes.set(current.value,node);
  if(previous){
   const key=JSON.stringify([previous.value,current.value]);
   const edge=edges.get(key)??{from:previous.value,to:current.value,count:0,firstIndex:previous.index,examples:[]};
   edge.count++;if(edge.examples.length<5)edge.examples.push([previous.index,current.index]);edges.set(key,edge);
  }
  if(runs.length&&runs[runs.length-1].state===current.value){runs[runs.length-1].count++;runs[runs.length-1].end=current.index;}
  else runs.push({state:current.value,start:current.index,end:current.index,count:1});
  previous=current;
 }
 const transitions=[...edges.values()].sort((a,b)=>b.count-a.count||a.from.localeCompare(b.from)||a.to.localeCompare(b.to));
 const states=[...nodes.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
 const nonSelf=transitions.filter(edge=>edge.from!==edge.to);
 const recurring=nonSelf.filter(edge=>edge.count>=2);
 const warnings=[];
 if(observations.length<3)warnings.push("Fewer than three usable observations");
 if(states.length>32)warnings.push("Many unique values; this may be a counter or identifier, not a state");
 if(selected.incrementing)warnings.push("Selected field increments sequentially; likely counter rather than state");
 if(timeline.checksumFailures&&!includeInvalidChecksums)warnings.push("Frames with invalid checksums excluded");
 if(observations.some((o,i)=>i>0&&o.index-observations[i-1].index>1))warnings.push("Gaps between observations: transitions may cross rejected or excluded frames");
 return {protocolId:timeline.protocolId,fieldName:selected.name,fieldType:selected.type,total:timeline.total,matched:timeline.matched,used:observations.length,excluded:timeline.events.length-observations.length,states,transitions,recurring,runs,warnings,observations};
}
