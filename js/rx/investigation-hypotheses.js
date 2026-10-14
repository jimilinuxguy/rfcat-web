import {decodeProtocolPacket,validateProtocolDefinition} from "./protocol-definitions.js";
export const HYPOTHESIS_KINDS=Object.freeze(["counter","command","device-id","state","checksum","unknown"]);
export function normalizeHypothesis(input){
 if(!input||typeof input!=="object")throw Error("Hypothesis must be an object");
 const id=String(input.id??"");if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error("Invalid hypothesis ID");
 const field=String(input.field??"").trim();if(!field||field.length>60)throw Error("Invalid hypothesis field");
 const kind=String(input.kind??"unknown");if(!HYPOTHESIS_KINDS.includes(kind))throw Error("Invalid hypothesis kind");
 const notes=String(input.notes??"").trim();if(notes.length>2000)throw Error("Notes exceed 2000 characters");
 const confidence=String(input.confidence??"low");if(!["low","medium","high"].includes(confidence))throw Error("Invalid confidence");
 const evidence=Array.isArray(input.evidence)?input.evidence:[];if(evidence.length>200)throw Error("Too many evidence references");
 const seen=new Set();const refs=evidence.map(ref=>{if(!ref||typeof ref!=="object"||typeof ref.sessionId!=="string"||!ref.sessionId||ref.sessionId.length>120||!Number.isInteger(ref.captureIndex)||ref.captureIndex<0||ref.captureIndex>1000000)throw Error("Invalid evidence reference");const key=ref.sessionId+":"+ref.captureIndex;if(seen.has(key))throw Error("Duplicate evidence reference");seen.add(key);return {sessionId:ref.sessionId,captureIndex:ref.captureIndex};});
 return {id,field,kind,confidence,notes,evidence:refs};
}
export function evaluateHypothesis(definition,hypothesis,sessions){
 const protocol=validateProtocolDefinition(definition),h=normalizeHypothesis(hypothesis);
 const field=protocol.fields.find(f=>f.name===h.field);if(!field)throw Error("Hypothesis field is missing from the protocol definition");
 if(!Array.isArray(sessions)||sessions.length>100)throw Error("Select up to 100 independent sessions");
 const ids=new Set(),results=[];for(const session of sessions){
  if(!session||typeof session.id!=="string"||!session.id||ids.has(session.id))throw Error("Sessions must have distinct IDs");ids.add(session.id);
  const captures=Array.isArray(session.captures)?session.captures:[];if(captures.length>10000)throw Error("Session exceeds 10000 captures");
  let matched=0,contradictions=0;const observations=[];
  for(let i=0;i<captures.length;i++){const raw=captures[i]?.hex??captures[i]?.packetHex??"";let decoded;try{decoded=decodeProtocolPacket(protocol,raw);}catch{contradictions++;continue;}if(!decoded.matched){contradictions++;continue;}const value=decoded.fields.find(f=>f.name===h.field);if(!value){contradictions++;continue;}matched++;observations.push({index:i,value:value.value,valid:value.valid??null});if(h.kind==="checksum"&&value.valid===false)contradictions++;}
  if(h.kind==="counter"&&observations.length>1)for(let i=1;i<observations.length;i++)if(typeof observations[i].value!=="number"||typeof observations[i-1].value!=="number"||observations[i].value<=observations[i-1].value)contradictions++;
  if(h.kind==="device-id"&&observations.length>1)for(let i=1;i<observations.length;i++)if(observations[i].value!==observations[0].value)contradictions++;
  results.push({sessionId:session.id,name:String(session.name??session.id),total:captures.length,matched,contradictions,observations:observations.slice(0,200)});
 }
 const linked=h.evidence.map(ref=>{const session=sessions.find(s=>s.id===ref.sessionId),capture=session?.captures?.[ref.captureIndex];if(!capture)return {...ref,status:"missing"};try{const decoded=decodeProtocolPacket(protocol,capture.hex??capture.packetHex??"");return {...ref,status:decoded.matched&&decoded.fields.some(f=>f.name===h.field)?"supporting":"contradictory"};}catch{return {...ref,status:"contradictory"};}});
 const supported=results.filter(r=>r.matched>0).length,contradictions=results.reduce((n,r)=>n+r.contradictions,0);
 const verdict=supported<2?"insufficient":contradictions?"contradictory":"consistent";
 return {schemaVersion:1,hypothesis:h,protocolId:protocol.id,verdict,supportedSessions:supported,totalSessions:results.length,contradictions,linkedEvidence:linked,sessions:results,interpretation:"Observed consistency is not proof of semantic meaning; confidence is user-assigned, not a statistical probability."};
}
