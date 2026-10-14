import {decodeProtocolPacket,validateProtocolDefinition} from "./protocol-definitions.js";
export const TIMELINE_MAX_CAPTURES=500;
function timestamp(capture){
 const value=capture?.timestamp??capture?.capturedAt??capture?.time??null;
 if(value==null||value==="")return null;
 if(typeof value==="number")return Number.isFinite(value)?value:null;
 const parsed=Date.parse(value);
 return Number.isFinite(parsed)?parsed:null;
}
export function analyzeProtocolTimeline(definition,captures){
 const protocol=validateProtocolDefinition(definition);
 if(!Array.isArray(captures)||captures.length<2||captures.length>TIMELINE_MAX_CAPTURES)throw Error("Timeline requires 2–500 captures");
 const events=captures.map((capture,index)=>{
  const raw=typeof capture==="string"?capture:capture?.hex;
  const time=typeof capture==="string"?null:timestamp(capture);
  if(typeof raw!=="string"||!raw||raw.length>510||raw.length%2||!/^[0-9a-f]+$/i.test(raw))return {index,time,hex:null,matched:false,reason:"invalid hex",checksumsValid:null,fields:[]};
  const hex=raw.toUpperCase(),decoded=decodeProtocolPacket(protocol,hex);
  return {index,time,hex,matched:decoded.matched,reason:decoded.reason??null,checksumsValid:decoded.matched?decoded.checksumsValid:null,fields:decoded.fields};
 });
 const matched=events.filter(e=>e.matched);
 const fields=protocol.fields.filter(f=>f.type!=="checksum").map(field=>{
  const observations=matched.map(event=>({index:event.index,time:event.time,value:event.fields.find(f=>f.name===field.name)?.value,label:event.fields.find(f=>f.name===field.name)?.label??null}));
  const transitions=[];
  for(let i=1;i<observations.length;i++){
   const previous=observations[i-1],current=observations[i];
   if(current.value!==previous.value)transitions.push({from:previous.index,to:current.index,before:previous.value,after:current.value});
  }
  const numeric=field.type==="uint"||field.type==="bits"||field.type==="enum";
  const deltas=numeric?observations.slice(1).map((item,i)=>item.value-observations[i].value):[];
  const incrementing=deltas.length>=2&&deltas.every(d=>d===1);
  const stable=observations.length>=2&&transitions.length===0;
  const unique=new Set(observations.map(o=>String(o.value))).size;
  return {name:field.name,type:field.type,observations,transitions,uniqueValues:unique,stable,incrementing,classification:incrementing?"sequential increment candidate":stable?"constant":transitions.length?"changing":"insufficient evidence"};
 });
 const repetitions=[];
 for(let i=1;i<events.length;i++)if(events[i].hex&&events[i].hex===events[i-1].hex)repetitions.push({from:i-1,to:i,hex:events[i].hex});
 return {protocolId:protocol.id,total:events.length,matched:matched.length,checksumFailures:matched.filter(e=>e.checksumsValid===false).length,hasTimestamps:events.some(e=>e.time!==null),events,fields,repetitions};
}
