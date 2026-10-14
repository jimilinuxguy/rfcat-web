import {decodeProtocolPacket,validateProtocolDefinition} from "./protocol-definitions.js";

const MAX_FIXTURES=200;
export function normalizeRegressionSuite(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Regression suite must be an object");
 if(input.schemaVersion!==1)throw Error("Unsupported regression suite schema");
 if(typeof input.protocolId!=="string"||!/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(input.protocolId))throw Error("Invalid protocol ID");
 if(!Array.isArray(input.fixtures)||input.fixtures.length>MAX_FIXTURES)throw Error("Fixtures must be an array of at most 200 cases");
 const ids=new Set();
 const fixtures=input.fixtures.map((fixture,index)=>{
  if(!fixture||typeof fixture!=="object"||Array.isArray(fixture))throw Error("Invalid fixture "+index);
  const id=String(fixture.id??"").trim();
  if(!id||id.length>80||ids.has(id))throw Error("Fixture IDs must be unique and nonempty (max 80 characters)");
  ids.add(id);
  if(typeof fixture.hex!=="string"||fixture.hex.length>510||fixture.hex.length%2||!/^[0-9a-f]+$/i.test(fixture.hex))throw Error("Fixture "+id+" must contain complete hex bytes");
  if(typeof fixture.expectMatch!=="boolean")throw Error("Fixture "+id+" requires expectMatch");
  if(fixture.expectChecksumValid!==undefined&&typeof fixture.expectChecksumValid!=="boolean")throw Error("Fixture "+id+" checksum expectation must be boolean");
  if(fixture.expectChecksumValid!==undefined&&!fixture.expectMatch)throw Error("Checksum expectation requires a matching packet");
  const expectedFields=fixture.expectedFields??{};
  if(!expectedFields||typeof expectedFields!=="object"||Array.isArray(expectedFields)||Object.keys(expectedFields).length>128)throw Error("Invalid expected fields for "+id);
  for(const [name,value] of Object.entries(expectedFields)){
   if(!name||name.length>60||!(typeof value==="string"||typeof value==="number"&&Number.isSafeInteger(value)))throw Error("Invalid field expectation in "+id);
  }
  if(!fixture.expectMatch&&Object.keys(expectedFields).length)throw Error("Field expectations require a matching packet");
  return {id,hex:fixture.hex.toUpperCase(),expectMatch:fixture.expectMatch,...(fixture.expectChecksumValid===undefined?{}:{expectChecksumValid:fixture.expectChecksumValid}),expectedFields:{...expectedFields}};
 });
 return {schemaVersion:1,protocolId:input.protocolId,fixtures};
}
export function runProtocolRegression(definition,suite){
 const protocol=validateProtocolDefinition(definition),normalized=normalizeRegressionSuite(suite);
 if(protocol.id!==normalized.protocolId)throw Error("Regression suite belongs to a different protocol");
 const cases=normalized.fixtures.map(fixture=>{
  const result=decodeProtocolPacket(protocol,fixture.hex);
  const failures=[];
  if(result.matched!==fixture.expectMatch)failures.push("match: expected "+fixture.expectMatch+", got "+result.matched);
  if(fixture.expectChecksumValid!==undefined&&(result.matched?result.checksumsValid:null)!==fixture.expectChecksumValid)failures.push("checksum: expected "+fixture.expectChecksumValid);
  for(const [name,expected] of Object.entries(fixture.expectedFields)){
   const field=result.fields.find(field=>field.name===name);
   if(!field)failures.push("field "+name+": missing");
   else if(field.value!==expected&&field.label!==expected)failures.push("field "+name+": expected "+JSON.stringify(expected)+", got "+JSON.stringify(field.value));
  }
  return {id:fixture.id,passed:failures.length===0,failures};
 });
 return {protocolId:protocol.id,total:cases.length,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,cases};
}
export function appendRegressionFixture(suite,fixture){
 return normalizeRegressionSuite({...normalizeRegressionSuite(suite),fixtures:[...suite.fixtures,fixture]});
}
