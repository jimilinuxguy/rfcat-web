import {decodeProtocolPacket,validateProtocolDefinition} from "./protocol-definitions.js";
export function compareProtocolPackets(definition,packets){
 const protocol=validateProtocolDefinition(definition);
 if(!Array.isArray(packets)||packets.length<2||packets.length>24)throw Error("Select 2–24 packets to compare");
 const rows=packets.map((packet,index)=>{
  const hex=typeof packet==="string"?packet:packet?.hex;
  const id=typeof packet==="string"?"Packet "+(index+1):String(packet?.id??"Packet "+(index+1));
  if(typeof hex!=="string"||hex.length<2||hex.length>510||hex.length%2||!/^[0-9a-f]+$/i.test(hex))throw Error("Packet "+(index+1)+" must contain complete hex bytes");
  const clean=hex.toUpperCase(),result=decodeProtocolPacket(protocol,clean);
  return {id:id.slice(0,100),hex:clean,matched:result.matched,reason:result.reason??null,checksumsValid:result.matched?result.checksumsValid:null,fields:result.fields};
 });
 const fields=protocol.fields.map(field=>{
  const values=rows.map(row=>{
   const decoded=row.fields.find(item=>item.name===field.name);
   return decoded?{raw:decoded.raw,value:decoded.value,...(decoded.label==null?{}:{label:decoded.label}),...(decoded.type==="checksum"?{valid:decoded.valid,expected:decoded.expected}:{})}:null;
  });
  const unique=new Set(values.filter(Boolean).map(value=>JSON.stringify([value.value,value.label??null,value.valid??null])));
  return {name:field.name,type:field.type,start:field.start,width:field.width,values,changed:unique.size>1,observed:values.filter(Boolean).length};
 });
 const byteDiffs=Array.from({length:protocol.packetLength},(_,offset)=>{
  const values=rows.map(row=>row.hex.length===protocol.packetLength*2?row.hex.slice(offset*2,offset*2+2):null);
  return {offset,values,changed:new Set(values.filter(v=>v!==null)).size>1};
 });
 return {protocolId:protocol.id,total:rows.length,matched:rows.filter(r=>r.matched).length,checksumFailures:rows.filter(r=>r.matched&&r.checksumsValid===false).length,rows,fields,byteDiffs};
}
