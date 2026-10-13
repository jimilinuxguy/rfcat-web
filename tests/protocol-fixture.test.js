import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseFlipperRaw,analyzePulses} from "../js/rx/signal-fingerprint.js";
import {decodeHypotheses} from "../js/rx/signal-decode.js";
import {inspectField,defineProtocol,inspectProtocol,inferVariableRuns,checksumCandidates} from "../js/rx/protocol-workbench.js";

const raw=readFileSync(new URL("./fixtures/01_ook_repeated_frames.sub",import.meta.url),"utf8");
const expected="101010101010101010101010110011001011001010001110";
test("OOK fixture imports as three identical 38-interval frames",()=>{
 const capture=parseFlipperRaw(raw);
 const analysis=analyzePulses(capture);
 assert.equal(capture.frequencyHz,433920000);
 assert.equal(capture.configuredModulation,"ASK/OOK");
 assert.equal(capture.durationsUs.length,116);
 assert.equal(analysis.estimatedUnitUs,500);
 assert.deepEqual(analysis.gaps.map(g=>g.durationUs),[10000,10000]);
 assert.deepEqual(analysis.frames.map(f=>f.durationsUs.length),[38,38,38]);
});
test("OOK fixture NRZ hypothesis yields identical 48-bit candidates",()=>{
 const analysis=analyzePulses(parseFlipperRaw(raw));
 const bits=analysis.frames.map(f=>decodeHypotheses(f.durationsUs,analysis.estimatedUnitUs).candidates.find(c=>c.encoding==="NRZ").bits);
 assert.deepEqual(bits,[expected,expected,expected]);
 const inference=inferVariableRuns(bits);
 assert.equal(inference.stableBits,48);
 assert.deepEqual(inference.variableRuns,[]);
});
test("OOK fixture field selection and export definition round-trip",()=>{
 const analysis=analyzePulses(parseFlipperRaw(raw));
 const bits=decodeHypotheses(analysis.frames[0].durationsUs,500).candidates.find(c=>c.encoding==="NRZ").bits;
 const definition=defineProtocol({name:"Synthetic OOK",bitLength:bits.length,fields:[
  {name:"preamble",start:0,length:24,endianness:"msb"},
  {name:"payload",start:24,length:24,endianness:"msb"}
 ]});
 assert.equal(definition.schema,"rfcat-web.protocol.v1");
 assert.equal(definition.verified,false);
 const fields=inspectProtocol(definition,bits);
 assert.equal(fields[0].hex,"0xAAAAAA");
 assert.equal(fields[1].hex,"0xCCB28E");
 assert.equal(inspectField(bits,24,8,{endianness:"lsb"}).hex,"0x33");
 const restored=JSON.parse(JSON.stringify(definition));
 assert.deepEqual(inspectProtocol(restored,bits),fields);
 const checks=checksumCandidates(bits.match(/.{8}/g).map(b=>parseInt(b,2)));
 assert.equal(checks.length,2);
 assert.ok(checks.every(c=>c.verified===false));
});
