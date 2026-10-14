// Heuristic evidence only: these candidates do not establish protocol semantics.
function confidence(score){return score>=0.9?"high":score>=0.7?"medium":"low";}
function candidate(kind,start,width,score,evidence,extra={}){return {kind,start,width,score:Math.round(score*100)/100,confidence:confidence(score),evidence,...extra};}
function byteRows(rows){return (Array.isArray(rows)?rows:[]).filter(row=>Array.isArray(row.bytes)&&row.bytes.length>0&&row.bytes.every(byte=>typeof byte==="string"&&/^[0-9a-f]{2}$/i.test(byte))).map(row=>row.bytes.map(byte=>parseInt(byte,16)));}
function progression(values){if(values.length<3)return null;const deltas=values.slice(1).map((value,i)=>(value-values[i]+0x100000000)%0x100000000);const increments=deltas.filter(delta=>delta===1).length;const same=deltas.filter(delta=>delta===deltas[0]).length;const ratio=Math.max(increments,same)/deltas.length;if(deltas[0]===0||ratio<0.75)return null;return {ratio,step:increments>=same?1:deltas[0]};}
export function inferFieldCandidates(rows,{maxCandidates=24}={}){
 const packets=byteRows(rows);if(packets.length<3)return [];
 const length=packets[0].length;if(!packets.every(p=>p.length===length))return [];
 const result=[];
 // Multi-byte counters: both byte orders are tested. A constant high byte is not enough
 // to qualify; the candidate must contain variation and show a consistent progression.
 for(let width=2;width<=Math.min(4,length);width++)for(let start=0;start+width<=length;start++){
  for(const endian of ["big","little"]){
   const values=packets.map(packet=>{const bytes=packet.slice(start,start+width);if(endian==="little")bytes.reverse();return bytes.reduce((n,b)=>((n*256)+b)>>>0,0);});
   if(new Set(values).size<3)continue;
   const match=progression(values);if(!match)continue;
   const score=Math.min(0.94,0.52+match.ratio*0.38+(packets.length>=5?0.04:0));
   result.push(candidate("counter",start,width,score,`Observed ${match.step}-step progression across ${packets.length} packets (${Math.round(match.ratio*100)}% matching transitions); ${endian}-endian hypothesis.`,{endian,step:match.step}));
  }
 }
 // Bit-level variability: expose masks for bits that change, but never label them as flags.
 for(let start=0;start<length;start++){
  const values=packets.map(p=>p[start]);const and=values.reduce((a,b)=>a&b,255),or=values.reduce((a,b)=>a|b,0),mask=and^or;
  if(mask===0||mask===255)continue;
  const count=mask.toString(2).replace(/0/g,"").length;
  result.push(candidate("bit-mask",start,1,Math.min(0.8,0.45+0.06*packets.length),`${count} of 8 bits vary across ${packets.length} packets; variability alone does not identify flag meaning.`,{mask:"0x"+mask.toString(16).toUpperCase().padStart(2,"0")}));
 }
 // Test common simple trailing checksums, excluding the checksum byte itself.
 // Require changing payloads AND checksum values to avoid constant-byte coincidences.
 if(length>=3){
  const position=length-1,observed=packets.map(p=>p[position]);
  if(new Set(observed).size>=2&&new Set(packets.map(p=>p.slice(0,-1).join(","))).size>=3){
   for(const algorithm of ["xor8","sum8","sum8-twos-complement"]){
    const matches=packets.filter(packet=>{const data=packet.slice(0,-1);const sum=data.reduce((a,b)=>a+b,0)&255;const expected=algorithm==="xor8"?data.reduce((a,b)=>a^b,0):algorithm==="sum8"?sum:(-sum)&255;return expected===packet[position];}).length;
    if(matches===packets.length)result.push(candidate("checksum",position,1,Math.min(0.95,0.58+0.055*packets.length),`All ${packets.length} packets match ${algorithm} over bytes 0–${position-1}; verify with new independent captures.`,{algorithm}));
   }
  }
 }
 return result.sort((a,b)=>b.score-a.score||a.start-b.start||a.width-b.width||a.kind.localeCompare(b.kind)).slice(0,Math.max(0,Math.min(100,Math.floor(maxCandidates)||0)));
}
