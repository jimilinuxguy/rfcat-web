import {normalizeHypothesis} from "../rx/investigation-hypotheses.js";
import {getStoredValue,getAllStoredValues,putStoredValue,deleteStoredValue} from "./db.js";
export const INVESTIGATION_STORE="protocol-investigations";
export function normalizeInvestigation(value){
 if(!value||typeof value!=="object"||typeof value.id!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(value.id))throw Error("Invalid investigation ID");
 const name=String(value.name??"").trim();if(!name||name.length>120)throw Error("Investigation name must be 1–120 characters");
 const ref=v=>v==null||v===""?null:typeof v==="string"&&v.length<=120?v:(()=>{throw Error("Invalid investigation reference");})();
 return {schemaVersion:1,id:value.id,name,definitionId:ref(value.definitionId),sessionId:ref(value.sessionId),stage:["captures","definition","validation","decoder","timeline","states","export"].includes(value.stage)?value.stage:"captures",stateField:ref(value.stateField),hypotheses:(Array.isArray(value.hypotheses)?value.hypotheses:[]).slice(0,100).map(normalizeHypothesis),updatedAt:typeof value.updatedAt==="string"?value.updatedAt:new Date().toISOString()};
}
export async function listInvestigations(){return (await getAllStoredValues(INVESTIGATION_STORE)).map(normalizeInvestigation).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function getInvestigation(id){const v=await getStoredValue(INVESTIGATION_STORE,id);return v?normalizeInvestigation(v):null;}
export async function saveInvestigation(input){const item=normalizeInvestigation({...input,updatedAt:new Date().toISOString()});await putStoredValue(INVESTIGATION_STORE,item.id,item);return item;}
export async function deleteInvestigation(id){return deleteStoredValue(INVESTIGATION_STORE,id);}
