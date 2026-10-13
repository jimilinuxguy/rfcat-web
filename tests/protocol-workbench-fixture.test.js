import test from "node:test";
import assert from "node:assert/strict";
import {parseFlipperRaw,analyzePulses} from "../js/rx/signal-fingerprint.js";
import {decodeHypotheses} from "../js/rx/signal-decode.js";
import {inspectField,defineProtocol,inspectProtocol,inferVariableRuns,checksumCandidates} from "../js/rx/protocol-workbench.js";

// Reproduces the exact three repeated 38-run frames in 01_ook_repeated_frames.sub.
const expected="101010101010101010101010110011001011001010001110";
const runs=expected.match(/1+|0+/g).map(s=>(s[0]==="1"?1:-1)*s.length*500);
const raw="Filetype: Flipper SubGhz RAW File\nVersion: 1\nFrequency: 433920000\nPreset: FuriHalSubGhzPresetOok650Async\nProtocol: RAW\nRAW_Data: "+[...runs,-10000,...runs,-10000,...runs].join(" ");
test("M5 fixture: repeated OOK RAW frames decode to identical 48-bit NRZ candidates",()=>{
 const capture=parseFlipperRaw(raw);
 const analysis=analyzePulses(capture);
 assert.equal(capture.frequencyHz,433920000);
 assert.equal(capture.configuredModulation,"ASK/OOK");
 assert.equal(capture.durationsUs.length,116);
 assert.equal(analysis.estimatedUnitUs,500);
 assert.equal(analysis.frames.length,3);
 assert.deepEqual(analysis.frames.map(f=>f.durationsUs.length),[38,38,38]);
 const bits=analysis.frames.map(f=>decodeHypotheses(f.durationsUs,analysis.estimatedUnitUs).candidates.find(c=>c.encoding==="NRZ").bits);
 assert.deepEqual(bits,[expected,expected,expected]);
 assert.equal(BigInt("0b"+bits[0]).toString(16).toUpperCase(),"AAAAAACCB28E");
 const inferred=inferVariableRuns(bits);
 assert.equal(inferred.stableBits,48);
 assert.deepEqual(inferred.variableRuns,[]);
});
test("M5 fixture: first 8-bit field is AA and definition round-trips",()=>{
 const def=defineProtocol({name:"OOK repeated test",bitLength:48,fields:[{name:"preamble",start:0,length:8,endianness:"msb"},{name:"candidate",start:8,length:8,endianness:"lsb"}]});
 assert.equal(def.verified,false);
 assert.equal(inspectField(expected,0,8).hex,"0xAA");
 const inspected=inspectProtocol(JSON.parse(JSON.stringify(def)),expected);
 assert.equal(inspected[0].decimal,"170");
 assert.equal(inspected.length,2);
 assert.equal(checksumCandidates(expected.match(/.{8}/g).map(v=>parseInt(v,2))).every(c=>c.verified===false),true);
});
