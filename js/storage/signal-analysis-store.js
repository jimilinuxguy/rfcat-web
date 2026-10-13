import {putStoredValue,getStoredValue,deleteStoredValue,getAllStoredValues} from "./db.js";
const STORE="signal-analyses";
export function validateSignalCapture(capture){
 if(!capture||!Array.isArray(capture.durationsUs)||capture.durationsUs.length<1||capture.durationsUs.length>250000||capture.durationsUs.some(v=>!Number.isSafeInteger(v)||v===0))throw Error("Invalid pulse capture");
 return capture;
}
export async function saveSignalAnalysis(capture,{id=crypto.randomUUID(),name="RF signal analysis"}={}){
 validateSignalCapture(capture);
 const entry={id,name:String(name).slice(0,120),createdAt:new Date().toISOString(),capture};
 await putStoredValue(STORE,id,entry);return entry;
}
export async function loadSignalAnalysis(id){
 const entry=await getStoredValue(STORE,id);
 if(!entry)throw Error("Saved analysis not found");
 validateSignalCapture(entry.capture);return entry;
}
export async function listSignalAnalyses(){
 return (await getAllStoredValues(STORE)).map(({id,name,createdAt,capture})=>({id,name,createdAt,frequencyHz:capture?.frequencyHz??null})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export const deleteSignalAnalysis=id=>deleteStoredValue(STORE,id);
