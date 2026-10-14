// Offline, evidence-first analysis of demodulated packet bytes.
// This cannot identify RF modulation or infer over-the-air pulse timing.

function inferFieldCandidates(packets,bytes){
 const unique=[...new Map(packets.map(packet=>[packet.join(""),packet])).values()];
 const candidates=[];
 for(const field of bytes){
  if(field.kind!=="variable")continue;
  const offset=field.offset;
  const values=unique.map(packet=>parseInt(packet[offset],16));
  const transitions=values.slice(1).map((v,i)=>(v-values[i]+256)%256);
  const forward=transitions.filter(delta=>delta===1).length;
  const backward=transitions.filter(delta=>delta===255).length;
  const steps=transitions.length;
  const distinct=new Set(values).size;
  const sequential=steps>=3&&Math.max(forward,backward)/steps>=0.75;
  const smallDomain=distinct<=4&&unique.length>=4;
  const label=sequential?"candidate counter":smallDomain?"candidate command/flag":"variable byte";
  const score=sequential?Math.max(forward,backward)/steps:smallDomain?distinct/unique.length:0;
  candidates.push({
   offset,widthBytes:1,label,
   confidence:sequential?"moderate":smallDomain?"low":"insufficient",
   score:Number(score.toFixed(2)),distinctValues:distinct,
   evidence:sequential?"Mostly unit-step transitions in first-seen unique payload order; capture order may not reflect device sequence.":smallDomain?"Few distinct values across unique payloads; may be a command, flag, identifier, or unrelated data.":"Variation observed without enough evidence to assign semantics.",
   caveat:"Heuristic only. No device identity, command, checksum, or counter is verified."
  });
 }
 return candidates;
}

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
  fields.push({length,packetCount:packets.length,bytes:changes,candidates:inferFieldCandidates(packets,changes)});
 }
 const profiles=[];
 const validCaptures=valid.map(v=>v.capture);
 const named=validCaptures.filter(c=>typeof c.protocol==="string"&&c.protocol.trim());
 for(const protocol of [...new Set(named.map(c=>c.protocol))]){
  const count=named.filter(c=>c.protocol===protocol).length;
  profiles.push({name:protocol,source:"capture decoder metadata",supportingCaptures:count,confidence:"unverified",reason:"A capture decoder reported this label; no independent protocol verification was performed."});
 }
 return {
  schemaVersion:2,type:"rfcat-signal-intelligence",analyzedAt:new Date().toISOString(),
  totalCaptures:captures.length,validCaptures:valid.length,invalidIndexes:invalid,
  uniquePayloads:groups.size,
  repeatedPayloads:[...groups.values()].filter(g=>g.count>1).sort((a,b)=>b.count-a.count),
  lengths:[...lengths].map(([bytes,count])=>({bytes,count})).sort((a,b)=>a.bytes-b.bytes),
  fields,profiles,
  modulation:{classification:"unknown",reason:"Demodulated bytes alone do not establish RF modulation or pulse timing."},
  warnings:["Changing bytes may represent counters, identifiers, checksums, or noise; no field semantics are proven.","Matching payloads do not establish a protocol identity.","Candidate counters and command fields are heuristic and must be independently validated."]
 };
}
