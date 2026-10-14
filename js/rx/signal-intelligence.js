// Offline, evidence-first analysis of demodulated packet bytes.
// This cannot identify RF modulation or infer over-the-air pulse timing.
export function analyzeSignalCaptures(captures){
 if(!Array.isArray(captures))throw new TypeError("Captures must be an array");
 const valid=[],invalid=[];
 for(let i=0;i<captures.length;i++){
  const item=captures[i],raw=item?.hex;
  if(typeof raw!=="string"||!/^(?:[0-9a-fA-F]{2})+$/.test(raw.replace(/\s+/g,""))){invalid.push(i);continue;}
  valid.push({index:i,hex:raw.replace(/\s+/g,"").toUpperCase(),capture:item});
 }
 const groups=new Map();
 for(const item of valid){
  const key=item.hex;
  if(!groups.has(key))groups.set(key,{hex:key,count:0,indexes:[]});
  const group=groups.get(key);group.count++;group.indexes.push(item.index);
 }
 const lengths=new Map(),bytesByLength=new Map();
 for(const item of valid){
  const length=item.hex.length/2;
  lengths.set(length,(lengths.get(length)||0)+1);
  if(!bytesByLength.has(length))bytesByLength.set(length,[]);
  bytesByLength.get(length).push(item.hex.match(/../g));
 }
 const fields=[];
 for(const [length,packets] of bytesByLength){
  if(packets.length<2)continue;
  const changes=[];
  for(let offset=0;offset<length;offset++){
   const values=[...new Set(packets.map(bytes=>bytes[offset]))];
   changes.push({offset,kind:values.length===1?"fixed":"variable",distinctValues:values.length,examples:values.slice(0,6)});
  }
  fields.push({length,packetCount:packets.length,bytes:changes});
 }
 const profiles=[];
 const validCaptures=valid.map(v=>v.capture);
 const named=validCaptures.filter(c=>typeof c.protocol==="string"&&c.protocol.trim());
 for(const protocol of [...new Set(named.map(c=>c.protocol))]){
  const count=named.filter(c=>c.protocol===protocol).length;
  profiles.push({name:protocol,source:"capture decoder metadata",supportingCaptures:count,confidence:"unverified",reason:"A capture decoder reported this label; no independent protocol verification was performed."});
 }
 return {
  schemaVersion:1,type:"rfcat-signal-intelligence",analyzedAt:new Date().toISOString(),
  totalCaptures:captures.length,validCaptures:valid.length,invalidIndexes:invalid,
  uniquePayloads:groups.size,
  repeatedPayloads:[...groups.values()].filter(g=>g.count>1).sort((a,b)=>b.count-a.count),
  lengths:[...lengths].map(([bytes,count])=>({bytes,count})).sort((a,b)=>a.bytes-b.bytes),
  fields,profiles,
  modulation:{classification:"unknown",reason:"Demodulated bytes alone do not establish RF modulation or pulse timing."},
  warnings:["Changing bytes may represent counters, identifiers, checksums, or noise; no field semantics are proven.","Matching payloads do not establish a protocol identity."]
 };
}
