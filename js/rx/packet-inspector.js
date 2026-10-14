import {hex,parseHex} from "../core/bytes.js";
import {compareProtocolPackets} from "./protocol-packet-comparison.js";
import {decodeProtocolPacket,validateProtocolDefinition} from "./protocol-definitions.js";

export function inspectBytes(packet) {
 if(packet instanceof Uint8Array)return new Uint8Array(packet);
 if(packet?.bytes instanceof Uint8Array)return new Uint8Array(packet.bytes);
 const value=typeof packet==="string"?packet:packet?.hex??packet?.packetHex;
 if(typeof value!=="string"||!/^(?:[0-9a-f]{2})*$/i.test(value)||value.length>131072)throw Error("Packet must contain complete hexadecimal bytes");
 return parseHex(value);
}
export function inspectRows(bytes,perRow=16) {
 if(![8,16,32].includes(perRow))throw Error("Choose 8, 16 or 32 bytes per row");
 return Array.from({length:Math.ceil(bytes.length/perRow)},(_,i)=>{
  const offset=i*perRow,chunk=bytes.slice(offset,offset+perRow);
  return {offset,hex:hex(chunk),ascii:[...chunk].map(b=>b>=32&&b<=126?String.fromCharCode(b):".").join("")};
 });
}
export function inspectBits(bytes,order="msb") {
 if(!["msb","lsb"].includes(order))throw Error("Invalid bit display order");
 return [...bytes].map(b=>Array.from({length:8},(_,i)=>(b>>(order==="msb"?7-i:i))&1).join(""));
}
export function inspectSelection(bytes,start,length=1) {
 if(!Number.isInteger(start)||!Number.isInteger(length)||start<0||length<1||start+length>bytes.length)throw Error("Selection exceeds packet");
 const slice=bytes.slice(start,start+length);
 return {start,length,hex:hex(slice),ascii:inspectRows(slice,8).map(r=>r.ascii).join(""),binary:inspectBits(slice)};
}
// Absolute bit offsets count from the first byte, MSB (bit 7) first.
// Display order is independent of these canonical offsets.
export function inspectBitRange(bytes,startBit,bitLength=1) {
 if(!Number.isInteger(startBit)||!Number.isInteger(bitLength)||startBit<0||bitLength<1||startBit+bitLength>bytes.length*8)throw Error("Bit range exceeds packet");
 const bits=Array.from({length:bitLength},(_,i)=>{
  const absolute=startBit+i;
  return (bytes[Math.floor(absolute/8)]>>(7-absolute%8))&1;
 });
 const binary=bits.join("");
 const value=bits.reduce((n,bit)=>(n<<1n)|BigInt(bit),0n);
 return {startBit,bitLength,startByte:Math.floor(startBit/8),endByte:Math.floor((startBit+bitLength-1)/8),binary,hex:"0x"+value.toString(16).toUpperCase()};
}
export function overlappingFields(fields,startBit,bitLength) {
 if(!Number.isInteger(startBit)||!Number.isInteger(bitLength)||startBit<0||bitLength<1)throw Error("Invalid field selection");
 return fields.filter(field=>field.startBit<startBit+bitLength&&startBit<field.startBit+field.widthBits);
}
export function inspectFields(bytes,definition) {
 const protocol=validateProtocolDefinition(definition),result=decodeProtocolPacket(protocol,hex(bytes).replace(/ /g,""));
 if(!result.matched)return {matched:false,reason:result.reason,fields:[]};
 return {matched:true,fields:protocol.fields.map((field,i)=>({...field,...result.fields[i],startBit:field.start*8+(field.bitOffset??0),widthBits:field.type==="bits"?field.bitWidth:field.width*8}))};
}
export function inspectComparison(first,second) {
 const a=inspectBytes(first),b=inspectBytes(second);
 // Reuse the existing comparison engine for its supported 1–255 byte range.
 if(a.length&&b.length&&a.length<=255&&b.length<=255)return compareProtocolPackets([{hex:hex(a).replace(/ /g,"")},{hex:hex(b).replace(/ /g,"")}]);
 const length=Math.max(a.length,b.length);
 const regions=Array.from({length},(_,offset)=>({offset,values:[a[offset],b[offset]].map(v=>v==null?null:v.toString(16).padStart(2,"0").toUpperCase()),stable:a[offset]===b[offset]&&a[offset]!=null,changedBits:Array.from({length:8},(_,i)=>7-i).filter(i=>a[offset]==null||b[offset]==null||((a[offset]^b[offset])&(1<<i))!==0)}));
 return {schemaVersion:1,total:2,length,regions,pairs:[{packetIndex:1,changedBytes:regions.filter(r=>!r.stable).map(r=>r.offset)}],interpretation:"Observed differences only."};
}
export function inspectAnnotation(bytes,{start,width,label,notes=""}) {
 inspectSelection(bytes,start,width);
 if(typeof label!=="string"||!label.trim()||label.length>80||typeof notes!=="string"||notes.length>2000)throw Error("Invalid annotation");
 return {schemaVersion:1,start,width,label:label.trim(),notes};
}
export function inspectReport(packet,annotations=[]) {
 const bytes=inspectBytes(packet);
 return {schemaVersion:1,source:{...(packet&&typeof packet==="object"?Object.fromEntries(["id","timestamp","frequency","frequencyHz"].filter(k=>packet[k]!=null).map(k=>[k,packet[k]])):{})},observed:{hex:hex(bytes),length:bytes.length},annotations:annotations.map(a=>inspectAnnotation(bytes,a)),interpretation:"Field labels and annotations are user interpretations, not verified protocol facts."};
}
