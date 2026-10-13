import {getStoredValue,putStoredValue} from "./db.js";
const STORE="help";
export async function readHelpState(){return (await getStoredValue(STORE,"state"))??{onboarded:false,completed:[]};}
export async function writeHelpState(state){await putStoredValue(STORE,"state",state);return state;}
