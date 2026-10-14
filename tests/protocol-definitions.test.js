import test from "node:test";
import assert from "node:assert/strict";
import {validateProtocolDefinition,decodeProtocolPacket,validateProtocolCaptures,definitionFromAnnotations} from "../js/rx/protocol-definitions.js";
import {importProtocolDefinition} from "../js/storage/protocol-definition-store.js";
const definition={schemaVersion:1,id:"garage",name:"Garage sensor",packetLength:6,sync:"AA",frequencyHz:433920000,modulation:"OOK",fields:[
 {name:"device",start:1,width:2,type:"uint",endian:"big"},
 {name:"counter",start:3,width:2,type:"uint",endian:"little"},
 {name:"check",start:5,width:1,type:"checksum",algorithm:"xor8",checksumStart:0,checksumEnd:4}
]};
test("decodes integer byte orders and verifies checksums",()=>{
 const good=decodeProtocolPacket(definition,"AA12340700A9");
 assert.equal(good.matched,true);
 assert.equal(good.fields[0].value,0x1234);
 assert.equal(good.fields[1].value,7);
 assert.equal(good.fields[2].valid,false);
 const checksum=[0xAA,0x12,0x34,0x07,0].reduce((a,b)=>a^b,0).toString(16).padStart(2,"0");
 assert.equal(decodeProtocolPacket(definition,"AA12340700"+checksum).checksumsValid,true);
 assert.equal(decodeProtocolPacket(definition,"BB12340700"+checksum).reason,"sync");
 assert.equal(decodeProtocolPacket(definition,"AA1234").reason,"length");
});
test("bit fields and enum labels decode with validated widths",()=>{
 const def={schemaVersion:1,id:"flags",name:"Flags",packetLength:2,fields:[{name:"bits",start:0,width:1,type:"bits",bitOffset:2,bitWidth:3},{name:"mode",start:1,width:1,type:"enum",values:{"2":"open"}}]};
 const decoded=decodeProtocolPacket(def,"B002");
 assert.equal(decoded.fields[0].value,6);
 assert.equal(decoded.fields[1].label,"open");
});
test("schema rejects overlap, invalid checksum ranges, oversized numeric fields and unknown versions",()=>{
 assert.throws(()=>validateProtocolDefinition({...definition,schemaVersion:2}),/schema/);
 assert.throws(()=>validateProtocolDefinition({...definition,fields:[...definition.fields,{name:"other",start:4,width:1,type:"hex"}]}),/overlap/);
 assert.throws(()=>validateProtocolDefinition({...definition,fields:[{name:"bad",start:0,width:1,type:"checksum"}]}),/Checksum (end|input range)/);
 assert.throws(()=>validateProtocolDefinition({...definition,packetLength:7,fields:[{name:"huge",start:0,width:7,type:"uint"}]}),/six bytes/);
 assert.throws(()=>importProtocolDefinition('{"schemaVersion":1,"id":"x"}'),/Name/);
 assert.throws(()=>importProtocolDefinition("not-json"),/JSON/);
});
test("capture validation counts matches and checksum failures without mutating captures",()=>{
 const captures=[{hex:"AA12340700A9"},{hex:"AA12340700AB"},{hex:"BB12340700A9"},{hex:"zz"}];
 const snapshot=JSON.stringify(captures);
 const result=validateProtocolCaptures(definition,captures);
 assert.equal(result.total,4);assert.equal(result.matched,2);assert.equal(result.matchRate,0.5);
 assert.equal(result.checksumFailures,2);assert.equal(JSON.stringify(captures),snapshot);
});
test("promotion keeps annotations tentative and maps types conservatively",()=>{
 const def=definitionFromAnnotations({id:"test",name:"Test",packetLength:4,annotations:[{name:"count",start:0,width:2,kind:"counter"},{name:"payload",start:2,width:2,kind:"payload"}]});
 assert.deepEqual(def.fields.map(f=>f.type),["uint","hex"]);
 assert.equal(def.fields[0].endian,"big");
});
