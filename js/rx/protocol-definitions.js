// Versioned, declarative offline packet definitions. No dynamic code execution or RF commands.
export const PROTOCOL_DEFINITION_VERSION=1;
export const FIELD_TYPES=["hex","uint","bits","enum","checksum"];
export const CHECKSUM_ALGORITHMS=["xor8","sum8","sum8-twos-complement"];
function object(value){return value!==null&&typeof value==="object"&&!Array.isArray(value);}
function integer(value,min,max,label){if(!Number.isInteger(value)||value<min||value>max)throw Error(label+" must be an integer from "+min+" to "+max);return value;}
function hex(value,label,allowEmpty=false){if(typeof value!=="string"||(!allowEmpty&&!value)||value.length%2||!/^[0-9a-f]*$/i.test(value))throw Error(label+" must be complete hex bytes");return value.toUpperCase();}
function bytesFromHex(value){return value.match(/../g)?.map(b=>parseInt(b,16))||[];}
function checkName(value,label){if(typeof value!=="string"||!value.trim()||value.trim().length>60)throw Error(label+" must contain 1–60 characters");return value.trim();}
export function validateProtocolDefinition(input){
 if(!object(input))throw Error("Definition must be an object");
 if(input.schemaVersion!==PROTOCOL_DEFINITION_VERSION)throw Error("Unsupported protocol definition schema");
 const id=checkName(input.id,"ID");if(!/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(id))throw Error("ID must use letters, digits, hyphens or underscores");
 const name=checkName(input.name,"Name");
 const packetLength=integer(input.packetLength,1,255,"Packet length");
 const sync=hex(input.sync??"","Sync prefix",true);
 if(sync.length/2>packetLength)throw Error("Sync prefix exceeds packet length");
 const frequencyHz=input.frequencyHz==null?null:integer(input.frequencyHz,1,10000000000,"Frequency");
 const modulation=input.modulation==null?"":String(input.modulation).trim();
 if(modulation.length>40)throw Error("Modulation label is too long");
 if(!Array.isArray(input.fields)||input.fields.length>128)throw Error("Fields must be an array of at most 128 items");
 const occupied=new Set(),names=new Set();
 const fields=input.fields.map((field,i)=>{
  if(!object(field))throw Error("Invalid field "+i);
  const fieldName=checkName(field.name,"Field name");
  if(names.has(fieldName.toLowerCase()))throw Error("Duplicate field name");names.add(fieldName.toLowerCase());
  const start=integer(field.start,0,packetLength-1,"Field start");
  const width=integer(field.width,1,packetLength-start,"Field width");
  const type=field.type;
  if(!FIELD_TYPES.includes(type))throw Error("Unsupported field type");
  for(let j=start;j<start+width;j++){if(occupied.has(j))throw Error("Field ranges overlap");occupied.add(j);}
  const endian=field.endian??"big";if(!["big","little"].includes(endian))throw Error("Unsupported byte order");
  if(type==="uint"&&width>6)throw Error("Integer fields support up to six bytes");
  const bitOffset=type==="bits"?integer(field.bitOffset??0,0,width*8-1,"Bit offset"):0;
  const bitWidth=type==="bits"?integer(field.bitWidth??1,1,width*8-bitOffset,"Bit width"):0;
  if(type==="bits"&&width>6)throw Error("Bit fields support up to six bytes");
  const values=type==="enum"?(field.values??{}):{};
  if(!object(values)||Object.keys(values).length>128)throw Error("Invalid enum values");
  for(const [key,value] of Object.entries(values)){if(!/^(0|[1-9][0-9]*)$/.test(key)||!Number.isSafeInteger(Number(key))||typeof value!=="string"||value.length>80)throw Error("Invalid enum entry");}
  if(type==="enum"&&width>6)throw Error("Enum fields support up to six bytes");
  const algorithm=type==="checksum"?(field.algorithm??"xor8"):null;
  if(type==="checksum"&&(!CHECKSUM_ALGORITHMS.includes(algorithm)||width!==1))throw Error("Checksum must be one byte and use a supported algorithm");
  const checksumStart=type==="checksum"?integer(field.checksumStart??0,0,packetLength-1,"Checksum start"):0;
  const checksumEnd=type==="checksum"?integer(field.checksumEnd??start-1,0,packetLength-1,"Checksum end"):0;
  if(type==="checksum"&&(checksumEnd<checksumStart||checksumEnd>=start))throw Error("Checksum input range must precede the checksum byte");
  return {name:fieldName,start,width,type,endian,...(type==="bits"?{bitOffset,bitWidth}:{}),...(type==="enum"?{values}:{}),...(type==="checksum"?{algorithm,checksumStart,checksumEnd}:{})};
 });
 return {schemaVersion:1,id,name,packetLength,sync,frequencyHz,modulation,fields};
}
function readNumber(bytes,endian){const ordered=endian==="little"?[...bytes].reverse():bytes;return ordered.reduce((n,b)=>n*256+b,0);}
function checksum(data,algorithm){const sum=data.reduce((a,b)=>a+b,0)&255;return algorithm==="xor8"?data.reduce((a,b)=>a^b,0):algorithm==="sum8"?sum:(-sum)&255;}
export function decodeProtocolPacket(definition,packetHex){
 const protocol=validateProtocolDefinition(definition);
 const clean=hex(packetHex,"Packet");
 const bytes=bytesFromHex(clean);
 if(bytes.length!==protocol.packetLength)return {matched:false,reason:"length",fields:[],protocolId:protocol.id};
 if(protocol.sync&&!clean.startsWith(protocol.sync))return {matched:false,reason:"sync",fields:[],protocolId:protocol.id};
 const fields=protocol.fields.map(field=>{
  const slice=bytes.slice(field.start,field.start+field.width);
  const raw=slice.map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
  if(field.type==="hex")return {name:field.name,type:field.type,raw,value:raw};
  if(field.type==="checksum"){const expected=checksum(bytes.slice(field.checksumStart,field.checksumEnd+1),field.algorithm);return {name:field.name,type:field.type,raw,value:slice[0],expected,valid:slice[0]===expected};}
  const number=readNumber(slice,field.endian);
  if(field.type==="bits"){const divisor=2**(field.width*8-field.bitOffset-field.bitWidth);return {name:field.name,type:field.type,raw,value:Math.floor(number/divisor)%(2**field.bitWidth)};}
  if(field.type==="enum")return {name:field.name,type:field.type,raw,value:number,label:field.values[String(number)]??null};
  return {name:field.name,type:field.type,raw,value:number};
 });
 return {matched:true,protocolId:protocol.id,protocolName:protocol.name,fields,checksumsValid:fields.filter(f=>f.type==="checksum").every(f=>f.valid)};
}
export function validateProtocolCaptures(definition,captures){
 const protocol=validateProtocolDefinition(definition);
 const rows=(Array.isArray(captures)?captures:[]).map((capture,index)=>{
  try{return {index,...decodeProtocolPacket(protocol,capture?.hex??"")};}
  catch(error){return {index,matched:false,reason:"invalid hex",fields:[]};}
 });
 const matches=rows.filter(row=>row.matched);
 return {total:rows.length,matched:matches.length,matchRate:rows.length?matches.length/rows.length:0,checksumFailures:matches.filter(row=>!row.checksumsValid).length,rows};
}
export function definitionFromAnnotations({id,name,packetLength,annotations=[],sync="",frequencyHz=null,modulation=""}){
 const fields=annotations.map(a=>({name:a.name,start:a.start,width:a.width,type:a.kind==="checksum"&&a.width===1&&a.start>0?"checksum":a.kind==="counter"&&a.width<=6?"uint":"hex",...(a.kind==="checksum"&&a.width===1&&a.start>0?{algorithm:"xor8",checksumStart:0,checksumEnd:a.start-1}:{})}));
 return validateProtocolDefinition({schemaVersion:1,id,name,packetLength,sync,frequencyHz,modulation,fields});
}
