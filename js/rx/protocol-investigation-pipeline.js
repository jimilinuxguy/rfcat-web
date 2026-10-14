import {discoverProtocolCandidates,correlateCaptureSessions} from "./protocol-candidate-discovery.js";
import {analyzeProtocolBits} from "./protocol-bit-analysis.js";
import {discoverChecksums} from "./protocol-crc-discovery.js";
import {clusterProtocolCaptures} from "./protocol-clustering.js";
import {summarizeProtocolEvidence} from "./protocol-evidence-dashboard.js";
export function runProtocolInvestigationPipeline(sessions,{definition=null,investigation=null,maxDistance=8}={}){
 if(!Array.isArray(sessions)||!sessions.length)throw Error("Select saved sessions for investigation");
 const discovery=discoverProtocolCandidates(sessions),correlation=correlateCaptureSessions(sessions),bits=analyzeProtocolBits(sessions),checksums=discoverChecksums(sessions),clusters=clusterProtocolCaptures(sessions,{maxDistance});
 let evidence=null,evidenceError=null;if(definition){try{evidence=summarizeProtocolEvidence(investigation,definition,sessions);}catch(e){evidenceError=e.message;}}
 return {schemaVersion:1,sourceSessionIds:sessions.map(s=>s.id),discovery,correlation,bits,checksums,clusters,evidence,evidenceError,summary:{packetCount:discovery.valid,candidateLayouts:discovery.candidates.length,checksumCandidates:checksums.results.filter(r=>r.matched>=2).length,clusterCount:clusters.clusters.length,unresolved:["Candidate field semantics remain unverified","CRC and checksum matches can occur by chance","Clustering is threshold-sensitive",...(evidenceError?[evidenceError]:[])]},interpretation:"Offline reproducible exploratory analysis. Rankings, inferred roles and clusters are hypotheses, not verified protocol facts."};
}
