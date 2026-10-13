// Offline bit-field inspection and conservative protocol hypotheses.
export function validateBits(bits){
 if(typeof bits!=="string"||!/^[01]{1,16384}$/.test(bits))throw Error("Expected 1–16384 binary digits");
 return bits;
}
export function inspectField(bits,start,length,{name="field",endianness="msb"}={}){
 validateBits(bits);
 if(!Number.isInteger(start)||!Number.isInteger(length)||start<0||length<1||start+length>bits.length||length>64)throw Error("Invalid field range (1–64 bits)");
 if(!["msb","lsb"].includes(endianness))throw Error("Invalid bit order");
 const raw=bits.slice(start,start+length);
 const ordered=endianness==="lsb"?raw.split("").reverse().join(""):raw;
 const value=BigInt("0b"+ordered);
 return {name,start,length,endianness,bits:raw,hex:"0x"+value.toString(16).toUpperCase().padStart(Math.ceil(length/4),"0"),decimal:value.toString(10)};
}
export function defineProtocol({name,bitLength,fields}){
 if(typeof name!=="string"||!name.trim()||name.length>80||!/^[\w .-]+$/.test(name))throw Error("Invalid protocol name");
 if(!Number.isInteger(bitLength)||bitLength<1||bitLength>16384)throw Error("Invalid bit length");
 if(!Array.isArray(fields)||fields.length>64)throw Error("Invalid field definitions");
 const used=new Set();
 const clean=fields.map(f=>{
  if(typeof f.name!=="string"||!/^[A-Za-z][\w-]{0,39}$/.test(f.name)||used.has(f.name))throw Error("Invalid or duplicate field name");
  used.add(f.name);
  if(!Number.isInteger(f.start)||!Number.isInteger(f.length)||f.start<0||f.length<1||f.length>64||f.start+f.length>bitLength||!["msb","lsb"].includes(f.endianness))throw Error("Invalid field");
  return {name:f.name,start:f.start,length:f.length,endianness:f.endianness};
 });
 const sorted=[...clean].sort((a,b)=>a.start-b.start);
 for(let i=1;i<sorted.length;i++)if(sorted[i].start<sorted[i-1].start+sorted[i-1].length)throw Error("Overlapping fields");
 return {schema:"rfcat-web.protocol.v1",name:name.trim(),bitLength,fields:clean,verified:false};
}
export function inspectProtocol(definition,bits){
 const d=defineProtocol(definition);validateBits(bits);
 if(bits.length!==d.bitLength)throw Error("Bit length mismatch");
 return d.fields.map(f=>inspectField(bits,f.start,f.length,f));
}
export function inferVariableRuns(bitstreams){
 if(!Array.isArray(bitstreams)||bitstreams.length<2||bitstreams.length>64)throw Error("Supply 2–64 bitstreams");
 bitstreams.forEach(validateBits);
 const length=bitstreams[0].length;
 if(bitstreams.some(s=>s.length!==length))throw Error("Align frames before comparing bit positions");
 const runs=[];let start=-1;
 for(let i=0;i<=length;i++){
  const changed=i<length&&bitstreams.some(s=>s[i]!==bitstreams[0][i]);
  if(changed&&start<0)start=i;
  if(!changed&&start>=0){runs.push({start,length:i-start,kind:"variable",verified:false});start=-1;}
 }
 return {bitLength:length,frames:bitstreams.length,variableRuns:runs,stableBits:length-runs.reduce((n,r)=>n+r.length,0),warning:"Variable regions are candidates only; they do not establish counters, addresses, or checksums."};
}
export function checksumCandidates(bytes){
 if(!Array.isArray(bytes)||bytes.length<2||bytes.length>4096||bytes.some(b=>!Number.isInteger(b)||b<0||b>255))throw Error("Expected 2–4096 bytes");
 const payload=bytes.slice(0,-1),last=bytes.at(-1);
 const sum=payload.reduce((a,b)=>(a+b)&255,0);
 const xor=payload.reduce((a,b)=>a^b,0);
 return [{algorithm:"sum8",matches:sum===last,expected:sum,observed:last},{algorithm:"xor8",matches:xor===last,expected:xor,observed:last}].map(c=>({...c,verified:false}));
}
