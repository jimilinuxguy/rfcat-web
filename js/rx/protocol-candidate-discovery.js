// Offline byte-aligned inference only. Candidate scores are relative heuristics, never probabilities.
function bytes(c){const hex=c?.hex??c?.packetHex;if(typeof hex!=="string"||hex.length%2||!/^[0-9a-f]+$/i.test(hex)||!hex.length||hex.length>510)return null;return hex.match(/../g).map(x=>parseInt(x,16));}
export function discoverProtocolCandidates(sessions,{maxCandidates=5}={}){
 if(!Array.isArray(sessions)||sessions.length>100||!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>20)throw Error("Invalid discovery limits");
 const ids=new Set(),rows=[];let invalid=0;
 for(const s of sessions){if(!s||typeof s.id!=="string"||!s.id||ids.has(s.id))throw Error("Sessions must have unique IDs");ids.add(s.id);if(!Array.isArray(s.captures)||s.captures.length>10000)throw Error("Too many captures");for(const [index,c] of s.captures.entries()){const b=bytes(c);if(b)rows.push({sessionId:s.id,index,bytes:b});else invalid++;}}
 const lengths=new Map();for(const r of rows){const n=r.bytes.length;lengths.set(n,(lengths.get(n)??0)+1);}
 const candidates=[...lengths].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,maxCandidates).map(([length,count],rank)=>{
  const matched=rows.filter(r=>r.bytes.length===length),coverage=new Set(matched.map(r=>r.sessionId)).size;
  const columns=Array.from({length},(_,index)=>{const values=matched.map(r=>r.bytes[index]),unique=new Set(values);const bySession=sessions.filter(s=>matched.some(r=>r.sessionId===s.id)).map(s=>new Set(matched.filter(r=>r.sessionId===s.id).map(r=>r.bytes[index])));const constant=unique.size===1;const between=bySession.length>1&&bySession.every(set=>set.size===1)&&new Set(bySession.map(set=>[...set][0])).size>1;const sequential=matched.length>2&&matched.slice(1).every((r,i)=>r.bytes[index]===(matched[i].bytes[index]+1)%256);return {offset:index,distinct:unique.size,kind:constant?"constant":between?"session-identifier":sequential?"counter-candidate":"variable",constantValue:constant?values[0]:null,bySession:bySession.map((set,i)=>({sessionId:sessions.filter(s=>matched.some(r=>r.sessionId===s.id))[i].id,distinct:set.size,values:[...set].slice(0,8)}))};});
  const prefix=[];for(const col of columns){if(col.kind!=="constant")break;prefix.push(col.constantValue.toString(16).padStart(2,"0").toUpperCase());}
  const fields=[];let start=0;while(start<length){const kind=columns[start].kind;let end=start+1;while(end<length&&columns[end].kind===kind)end++;fields.push({name:kind.replace(/-/g,"_")+"_"+start,start,width:end-start,type:"hex"});start=end;}
  const score=Math.round(100*(0.65*count/Math.max(1,rows.length)+0.2*coverage/Math.max(1,sessions.length)+0.15*prefix.length/length));
  const definition={schemaVersion:1,id:"candidate_"+length+"_"+rank,name:"Inferred "+length+"-byte packet",packetLength:length,sync:prefix.join(""),fields};
  return {id:"length-"+length,length,count,coverage,score,columns,fields,definition,examples:matched.slice(0,25).map(r=>({sessionId:r.sessionId,captureIndex:r.index})),warnings:[...(coverage<2?["Fewer than two sessions support this layout."]:[]),"Field roles and boundaries are provisional. Score is not a probability."]};
 });
 return {schemaVersion:1,total:rows.length+invalid,valid:rows.length,invalid,sessions:sessions.length,candidates,interpretation:"Byte-aligned candidates only; capture order does not establish time or protocol semantics."};
}
export function correlateCaptureSessions(sessions){
 const discovery=discoverProtocolCandidates(sessions,{maxCandidates:20});
 return {schemaVersion:1,sessions:sessions.map(s=>({id:s.id,name:String(s.name??s.id),count:s.captures.length})),groups:discovery.candidates.map(c=>({length:c.length,count:c.count,coverage:c.coverage,columns:c.columns.map(({offset,kind,distinct,bySession})=>({offset,kind,distinct,bySession}))})),invalid:discovery.invalid,interpretation:"Within-session stability and between-session differences are observations, not confirmed identifiers or commands."};
}
