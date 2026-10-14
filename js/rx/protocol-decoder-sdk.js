import {decodeProtocolPacket,validateProtocolDefinition} from "./protocol-definitions.js";
// Trusted application modules register adapters explicitly. No eval, dynamic imports or executable JSON plugins.
export const DECODER_SDK_VERSION=1;
const adapters=new Map();
export function registerProtocolDecoder(adapter){
 if(!adapter||typeof adapter!=="object"||adapter.apiVersion!==DECODER_SDK_VERSION||typeof adapter.id!=="string"||!/^[a-z0-9_-]{1,60}$/.test(adapter.id)||typeof adapter.name!=="string"||!adapter.name.trim()||adapter.name.length>100||typeof adapter.decode!=="function")throw Error("Invalid decoder adapter");
 if(adapters.has(adapter.id))throw Error("Decoder ID already registered");
 const entry=Object.freeze({apiVersion:1,id:adapter.id,name:adapter.name,description:String(adapter.description??"").slice(0,300),decode:adapter.decode});
 adapters.set(entry.id,entry);return ()=>adapters.delete(entry.id);
}
export function listProtocolDecoders(){return [...adapters.values()].map(({id,name,description,apiVersion})=>({id,name,description,apiVersion}));}
export function decodeWithProtocolDecoder(id,definition,hex){
 const adapter=adapters.get(id);if(!adapter)throw Error("Unknown decoder adapter");
 const protocol=validateProtocolDefinition(definition);
 if(typeof hex!=="string"||hex.length>510||hex.length%2||!/^[0-9a-f]+$/i.test(hex))throw Error("Invalid packet hex");
 const result=adapter.decode(Object.freeze(protocol),hex.toUpperCase());
 if(!result||typeof result!=="object"||typeof result.matched!=="boolean"||!Array.isArray(result.fields)||result.fields.length>128)throw Error("Decoder returned invalid result");
 return {decoderId:id,protocolId:protocol.id,matched:result.matched,fields:result.fields.map(f=>({name:String(f.name??"").slice(0,60),value:typeof f.value==="number"||typeof f.value==="boolean"?f.value:String(f.value??"").slice(0,512)})),reason:String(result.reason??"").slice(0,160)};
}
registerProtocolDecoder({apiVersion:1,id:"declarative",name:"RFCat declarative fields",description:"Built-in offline protocol definition decoder",decode:(definition,hex)=>decodeProtocolPacket(definition,hex)});
