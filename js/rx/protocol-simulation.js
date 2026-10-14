import {decodeWithProtocolDecoder} from "./protocol-decoder-sdk.js";
import {validateProtocolDefinition} from "./protocol-definitions.js";
export function simulateProtocol(definition,captures,{adapterId="declarative",breakField="",breakValue=null}={}){
 const d=validateProtocolDefinition(definition);if(!Array.isArray(captures)||captures.length>10000)throw Error("Select up to 10000 packets");
 const frames=captures.map((capture,index)=>{const hex=capture?.hex??capture?.packetHex??"";try{const decoded=decodeWithProtocolDecoder(adapterId,d,hex);return {index,hex,matched:decoded.matched,fields:decoded.fields,reason:decoded.reason,breakpoint:breakField!==""&&decoded.fields.some(f=>f.name===breakField&&(breakValue===null||String(f.value)===String(breakValue)))};}catch(e){return {index,hex,matched:false,fields:[],reason:e.message,breakpoint:false};}});
 return {schemaVersion:1,adapterId,protocolId:d.id,frames,matched:frames.filter(f=>f.matched).length,breakpoints:frames.filter(f=>f.breakpoint).map(f=>f.index),interpretation:"Offline deterministic capture-order simulation; no RF transmission or timing reconstruction."};
}
export function simulationStep(report,index,direction=1){if(!report?.frames?.length)return null;return report.frames[Math.max(0,Math.min(report.frames.length-1,index+direction))];}
