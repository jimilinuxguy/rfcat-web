import {validateProtocolDefinition} from "../rx/protocol-definitions.js";
import {normalizeHypothesis} from "../rx/investigation-hypotheses.js";
import {getStoredValue,getAllStoredValues,putStoredValue,deleteStoredValue} from "./db.js";
export const INVESTIGATION_STORE="protocol-investigations";
export function normalizeInvestigation(value){
 if(!value||typeof value!=="object"||typeof value.id!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(value.id))throw Error("Invalid investigation ID");
 const name=String(value.name??"").trim();if(!name||name.length>120)throw Error("Investigation name must be 1–120 characters");
 const ref=v=>v==null||v===""?null:typeof v==="string"&&v.length<=120?v:(()=>{throw Error("Invalid investigation reference");})();
 return {schemaVersion:1,id:value.id,name,definitionId:ref(value.definitionId),sessionId:ref(value.sessionId),stage:["captures","definition","validation","decoder","timeline","states","evidence","discovery","simulation","synthetic","differential","dashboard","export"].includes(value.stage)?value.stage:"captures",stateField:ref(value.stateField),hypotheses:(Array.isArray(value.hypotheses)?value.hypotheses:[]).slice(0,100).map(normalizeHypothesis),candidateReview:normalizeCandidateReview(value.candidateReview),labSnapshot:normalizeLabSnapshot(value.labSnapshot),updatedAt:typeof value.updatedAt==="string"?value.updatedAt:new Date().toISOString()};
}
export function normalizeCandidateReview(input){if(input==null)return null;if(!input||input.schemaVersion!==1||!Array.isArray(input.candidates)||input.candidates.length>20||!Array.isArray(input.sourceSessionIds)||input.sourceSessionIds.length>100)throw Error("Invalid candidate review");const sourceSessionIds=input.sourceSessionIds.map(id=>{if(typeof id!=="string"||!id||id.length>120)throw Error("Invalid review session ID");return id;});const candidates=input.candidates.map(c=>{if(typeof c.id!=="string"||!/^length-[0-9]{1,3}$/.test(c.id)||!Number.isInteger(c.score)||c.score<0||c.score>100)throw Error("Invalid candidate");return {id:c.id,score:c.score,definition:validateProtocolDefinition(c.definition),warnings:Array.isArray(c.warnings)?c.warnings.slice(0,10).map(s=>String(s).slice(0,200)):[]};});return {schemaVersion:1,selectedId:String(input.selectedId??""),sourceSessionIds,candidates};}
export function normalizeLabSnapshot(input){if(input==null)return null;if(!input||input.schemaVersion!==1)throw Error("Invalid lab snapshot");const data=JSON.stringify(input);if(data.length>200000)throw Error("Lab snapshot exceeds storage limit");return JSON.parse(data);}
export async function listInvestigations(){return (await getAllStoredValues(INVESTIGATION_STORE)).map(normalizeInvestigation).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function getInvestigation(id){const v=await getStoredValue(INVESTIGATION_STORE,id);return v?normalizeInvestigation(v):null;}
export async function saveInvestigation(input){const item=normalizeInvestigation({...input,updatedAt:new Date().toISOString()});await putStoredValue(INVESTIGATION_STORE,item.id,item);return item;}
export async function deleteInvestigation(id){return deleteStoredValue(INVESTIGATION_STORE,id);}
