import {validateProtocolDefinition,validateProtocolCaptures} from "./protocol-definitions.js";

// Evidence scores summarize coverage and repeatability, not the probability a protocol is correct.
export function evaluateProtocolEvidence(definition,sessions){
 const protocol=validateProtocolDefinition(definition);
 if(!Array.isArray(sessions)||sessions.length>100)throw Error("Select up to 100 capture sessions");
 const ids=new Set();
 const reports=sessions.map(session=>{
  if(!session||typeof session.id!=="string"||!session.id.trim()||ids.has(session.id))throw Error("Sessions require distinct IDs");
  ids.add(session.id);
  const result=validateProtocolCaptures(protocol,session.captures);
  const matching=result.rows.filter(row=>row.matched);
  const checks=matching.flatMap(row=>row.fields.filter(field=>field.type==="checksum"));
  return {id:session.id,name:String(session.name||session.id),total:result.total,matched:result.matched,matchRate:result.matchRate,checksumChecks:checks.length,checksumPasses:checks.filter(field=>field.valid).length,invalid:result.rows.filter(row=>row.reason==="invalid hex").length};
 });
 const total=reports.reduce((n,r)=>n+r.total,0),matched=reports.reduce((n,r)=>n+r.matched,0);
 const checksumChecks=reports.reduce((n,r)=>n+r.checksumChecks,0),checksumPasses=reports.reduce((n,r)=>n+r.checksumPasses,0);
 const covered=reports.filter(r=>r.matched>0).length;
 const matchRate=total?matched/total:0;
 const checksumRate=checksumChecks?checksumPasses/checksumChecks:null;
 // Cap evidence without multiple sessions; do not let repeated packets alone yield high confidence.
 const sampleFactor=Math.min(1,matched/20);
 const coverageFactor=reports.length?covered/reports.length:0;
 const independenceFactor=Math.min(1,covered/3);
 const checksumFactor=checksumRate??0.5;
 const score=Math.round(100*matchRate*(0.35+0.25*sampleFactor+0.2*independenceFactor+0.2*checksumFactor)*coverageFactor);
 const label=matched<3||covered<2?"insufficient":score>=75&&covered>=3?"strong":score>=40?"moderate":"weak";
 const warnings=[];
 if(!total)warnings.push("No captures available.");
 if(covered<2)warnings.push("Fewer than two sessions contain matching packets; independent replication is missing.");
 if(matched<10)warnings.push("Fewer than ten matching packets; sample size is small.");
 if(checksumChecks&&checksumPasses<checksumChecks)warnings.push("One or more checksum checks failed.");
 if(!checksumChecks)warnings.push("No checksum evidence is available.");
 if(!protocol.sync)warnings.push("No sync prefix configured; length-only matches can be misleading.");
 if(reports.some(r=>r.invalid))warnings.push("Some captures contain invalid hex.");
 return {protocolId:protocol.id,score,label,total,matched,matchRate,coveredSessions:covered,totalSessions:reports.length,checksumChecks,checksumPasses,checksumRate,warnings,sessions:reports,interpretation:"Heuristic evidence summary only; not a calibrated probability or proof of protocol identity."};
}
