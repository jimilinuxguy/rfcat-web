import {getStoredValue,getAllStoredValues,putStoredValue,deleteStoredValue} from "./db.js";
import {validateProtocolDefinition} from "../rx/protocol-definitions.js";
export const PROTOCOL_DEFINITION_STORE="protocol-definitions";
export async function listProtocolDefinitions(){return (await getAllStoredValues(PROTOCOL_DEFINITION_STORE)).map(validateProtocolDefinition).sort((a,b)=>a.name.localeCompare(b.name));}
export async function getProtocolDefinition(id){const value=await getStoredValue(PROTOCOL_DEFINITION_STORE,id);return value==null?null:validateProtocolDefinition(value);}
export async function saveProtocolDefinition(input){const definition=validateProtocolDefinition(input);await putStoredValue(PROTOCOL_DEFINITION_STORE,definition.id,definition);return definition;}
export async function deleteProtocolDefinition(id){return deleteStoredValue(PROTOCOL_DEFINITION_STORE,id);}
export function importProtocolDefinition(text){let value;try{value=JSON.parse(text);}catch{throw Error("Invalid protocol definition JSON");}return validateProtocolDefinition(value);}
