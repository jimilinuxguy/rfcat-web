import test from "node:test";
import assert from "node:assert/strict";
import {MORSE,normalizeMessage,morseTiming,encodeMorse,decodeMorseRuns,packOokRuns,runsFromRawBytes,parseFlipperRawMorse} from "../js/cw/morse.js";
test("International Morse and strict input",()=>{
 assert.equal(MORSE.S,"...");assert.equal(MORSE.O,"---");
 assert.equal(normalizeMessage(" sos   sos "),"SOS SOS");
 for(const value of ["","@","A".repeat(121)])assert.throws(()=>normalizeMessage(value));
 for(const rate of [0,4,41,12.5])assert.throws(()=>morseTiming(rate));
});
test("exact timing and words",()=>{
 const result=encodeMorse("E T",20);
 assert.equal(result.code,". / -");
 assert.deepEqual(result.runs.map(x=>[x.level,x.units]),[[1,1],[0,7],[1,3]]);
 assert.equal(result.unitMs,60);
});
test("decode complete Morse pulses with fixed and automatic timing",()=>{
 const encoded=encodeMorse("SOS TEST 123",20);
 assert.equal(decodeMorseRuns(encoded.runs,{wpm:20}).text,"SOS TEST 123");
 assert.equal(decodeMorseRuns(encoded.runs).text,"SOS TEST 123");
 assert.equal(decodeMorseRuns(encoded.runs).confidence,1);
});
test("raw OOK pack and decode roundtrip",()=>{
 const encoded=encodeMorse("SOS",30);
 const packed=packOokRuns(encoded.runs,{sampleRate:1000});
 assert.ok(packed.bytes.length>0);
 const decoded=decodeMorseRuns(runsFromRawBytes(packed.bytes,1000),{wpm:30});
 assert.equal(decoded.text,"SOS");
});
test("hardware length and invalid run guards",()=>{
 assert.throws(()=>packOokRuns(encodeMorse("SOS SOS SOS SOS",5).runs),/exceeds/);
 assert.throws(()=>packOokRuns([{level:1,durationMs:1}],{sampleRate:10}));
 assert.throws(()=>decodeMorseRuns([{level:2,durationMs:100}]));
 assert.equal(decodeMorseRuns([]).text,"");
});

test("Flipper RAW Morse pulse import and validation",()=>{
 const encoded=encodeMorse("SOS",20);
 const raw="Filetype: Flipper SubGhz RAW File\\nVersion: 1\\nFrequency: 433920000\\nRAW_Data: "+encoded.runs.map(r=>(r.level?1:-1)*Math.round(r.durationMs*1000)).join(" ");
 const parsed=parseFlipperRawMorse(raw);
 assert.equal(decodeMorseRuns(parsed,{wpm:20}).text,"SOS");
 assert.throws(()=>parseFlipperRawMorse("RAW_Data: 1000 -1000"));
 assert.throws(()=>parseFlipperRawMorse("Filetype: Flipper SubGhz RAW File\\nRAW_Data: invalid"));
});
