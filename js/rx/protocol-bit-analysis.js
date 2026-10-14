// M32: observed bit variability, not proof of field semantics.
function parse(c){const h=c?.hex??c?.packetHex;return typeof h==="string"&&h.length>0&&h.length%2===0&&/^[0-9a-f]+$/i.test(h)&&h.length<=510?h.match(/../g).map(v=>parseInt(v,16)):null;}
export function analyzeProtocolBits(sessions,{maxPackets=10000}={}){
 if(!Array.isArray(sessions)||sessions.length>100||!Number.isInteger(maxPackets)||maxPackets<1||maxPackets>10000)throw Error("Invalid bit analysis limits");
 const groups=new Map();let invalid=0;
 for(const s of sessions){if(!s||typeof s.id!=="string"||!Array.isArray(s.captures)||s.captures.length>10000)throw Error("Invalid capture session");for(const [index,c] of s.captures.entries()){const b=parse(c);if(!b){invalid++;continue;}const arr=groups.get(b.length)??[];if(arr.length<maxPackets)arr.push({sessionId:s.id,index,bytes:b});groups.set(b.length,arr);}}
 return {schemaVersion:1,invalid,groups:[...groups].sort((a,b)=>b[1].length-a[1].length||a[0]-b[0]).map(([length,rows])=>{
 const bits=Array.from({length:length*8},(_,offset)=>{const values=rows.map(r=>(r.bytes[offset>>3]>>(7-(offset%8)))&1);const ones=values.reduce((a,b)=>a+b,0);const perSession=sessions.filter(s=>rows.some(r=>r.sessionId===s.id)).map(s=>{const selected=rows.filter(r=>r.sessionId===s.id),unique=new Set(selected.map(r=>(r.bytes[offset>>3]>>(7-offset%8))&1));return {id:s.id,distinct:unique.size};});return {offset,byte:offset>>3,bit:7-offset%8,ones,zeros:rows.length-ones,classification:ones===0||ones===rows.length?"constant":perSession.length>1&&perSession.every(s=>s.distinct===1)?"session-dependent":"variable"};});
 const distances=rows.slice(1).map((r,i)=>r.bytes.reduce((sum,byte,j)=>sum+((byte^rows[i].bytes[j]).toString(2).match(/1/g)?.length??0),0));
 const masks=Array.from({length},(_,i)=>bits.slice(i*8,i*8+8).reduce((m,b)=>m|(b.classification==="constant"?0:1<<b.bit),0));
 return {length,count:rows.length,bits,variableMasks:masks.map(x=>x.toString(16).padStart(2,"0").toUpperCase()),hamming:{comparisons:distances.length,min:distances.length?Math.min(...distances):null,max:distances.length?Math.max(...distances):null,mean:distances.length?distances.reduce((a,b)=>a+b,0)/distances.length:null},examples:rows.slice(0,20).map(({sessionId,index})=>({sessionId,index}))};
 }),interpretation:"Bit offsets use MSB-first numbering. Session-dependent bits and Hamming distance are observations, not decoded meanings."};
}
