import test from "node:test";
import assert from "node:assert/strict";
import {encodeMorse,packOokRuns} from "../js/cw/morse.js";
import {createCwStream,isIdleOokFrame} from "../js/cw/stream.js";
test("ignore repeated CC1111 idle signature without stripping active prefixes",()=>{
 assert.equal(isIdleOokFrame(Uint8Array.from([0xc0,0,0,0])),true);
 assert.equal(isIdleOokFrame(Uint8Array.from([0,0,0])),true);
 assert.equal(isIdleOokFrame(Uint8Array.from([0xc0,0,0xff])),false);
});
test("reassemble SOS across 203-byte packet boundaries and flush on idle",()=>{
 const encoded=encodeMorse("SOS",20);
 const {bytes}=packOokRuns(encoded.runs,{sampleRate:1000});
 const messages=[],statuses=[];
 const stream=createCwStream({sampleRate:1000,wpm:20,onMessage:x=>messages.push(x),onStatus:x=>statuses.push(x)});
 const idle=Uint8Array.from([0xc0,...new Array(202).fill(0)]);
 stream.push(idle);stream.push(idle);
 for(let i=0;i<bytes.length;i+=80)stream.push(bytes.slice(i,i+80));
 stream.push(idle);
 assert.equal(messages.length,1);
 assert.equal(messages[0].text,"SOS");
 assert.ok(statuses.some(x=>x.reason==="active"));
 assert.ok(statuses.some(x=>x.reason==="idle"));
});
test("low-confidence and incomplete fragments are not displayed as valid messages",()=>{
 const messages=[];
 const stream=createCwStream({sampleRate:1000,wpm:20,onMessage:x=>messages.push(x)});
 stream.push(Uint8Array.from([0xff,0xff,0xff]));
 stream.push(Uint8Array.from([0xc0,0,0]));
 assert.equal(messages.length,0);
 stream.reset();
 assert.equal(stream.status().frames,0);
});

test("single dot E is a valid completed CW message",()=>{
 const messages=[];
 const stream=createCwStream({sampleRate:1000,wpm:20,onMessage:x=>messages.push(x)});
 const dot=packOokRuns(encodeMorse("E",20).runs,{sampleRate:1000}).bytes;
 stream.push(dot);
 stream.push(Uint8Array.from([0xc0,0,0]));
 assert.equal(messages.length,1);
 assert.equal(messages[0].text,"E");
 assert.equal(stream.status().lastResult.marks,1);
 assert.match(stream.status().lastResult.runs,/\\+60ms/);
});
test("rejected signal exposes timing diagnostics instead of silently disappearing",()=>{
 const stream=createCwStream({sampleRate:1000,wpm:20});
 stream.push(Uint8Array.from([0xff,0xff,0xff]));
 stream.push(Uint8Array.from([0xc0,0,0]));
 const result=stream.status().lastResult;
 assert.equal(result.marks,1);
 assert.equal(result.bytes,3);
 assert.ok(result.confidence<0.65);
 assert.match(result.runs,/\\+24ms/);
});
