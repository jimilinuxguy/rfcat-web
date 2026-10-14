import {getStoredValue,putStoredValue,deleteStoredValue} from "./db.js";
import {normalizeRegressionSuite} from "../rx/protocol-regression.js";
export const PROTOCOL_REGRESSION_STORE="protocol-regressions";
export async function getProtocolRegressionSuite(protocolId){const suite=await getStoredValue(PROTOCOL_REGRESSION_STORE,protocolId);return suite==null?null:normalizeRegressionSuite(suite);}
export async function saveProtocolRegressionSuite(input){const suite=normalizeRegressionSuite(input);await putStoredValue(PROTOCOL_REGRESSION_STORE,suite.protocolId,suite);return suite;}
export async function deleteProtocolRegressionSuite(protocolId){await deleteStoredValue(PROTOCOL_REGRESSION_STORE,protocolId);}
export function importProtocolRegressionSuite(text){let parsed;try{parsed=JSON.parse(text);}catch{throw Error("Invalid regression suite JSON");}return normalizeRegressionSuite(parsed);}
