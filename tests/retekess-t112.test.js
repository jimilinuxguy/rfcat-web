import test from "node:test";
import assert from "node:assert/strict";
import { encodeRetekessT112, decodeRetekessT112 } from "../js/protocols/retekess-t112.js";
import { encodeRetekessTd161, decodeRetekessTd161 } from "../js/protocols/retekess-td161.js";
import { encodeRetekessTd164, decodeRetekessTd164 } from "../js/protocols/retekess-td164.js";
import { encodeRetekessPrinceton, decodeRetekessPrinceton } from "../js/protocols/retekess-pagger.js";

test("T112 builds 13/10/1 LSB-first payload and 349-symbol frame",()=>{const e=encodeRetekessT112({systemId:1,pagerId:69,cancel:false,frames:1});assert.equal(e.payload.length,24);assert.equal(e.waveform.length,349);assert.equal(e.payload.slice(0,13),"1000000000000");});
test("T112 cancel occupies final payload bit",()=>{const a=encodeRetekessT112({systemId:7,pagerId:69,cancel:false,frames:1});const b=encodeRetekessT112({systemId:7,pagerId:69,cancel:true,frames:1});assert.equal(a.payload.slice(0,-1),b.payload.slice(0,-1));assert.equal(a.payload.at(-1),"0");assert.equal(b.payload.at(-1),"1");});
test("TD161 produces 36 logical bits plus seven off symbols",()=>{const e=encodeRetekessTd161({systemId:30,pagerId:1,alertType:0,frames:1});assert.equal(e.logical.length,36);assert.equal(e.waveform.length,172);});
test("TD164 known pager fields and checksums",()=>{const e=encodeRetekessTd164({pagerId:30,sequenceNumber:0,functionCode:1,frames:1});assert.equal(e.hex.slice(0,28),"aaaaaaaaaaaaaaaaaaaa12340205");assert.equal(e.checksum1,5);assert.equal(e.checksum2,0);});
test("T119-style layout is 13 station + 10 pager + action",()=>{const e=encodeRetekessPrinceton({station:1,pager:69,action:0,frames:1});assert.equal(e.logical.length,24);assert.equal(e.logical.slice(0,13),"1000000000000");});
test("TD157-style layout keeps fields MSB-first",()=>{const e=encodeRetekessPrinceton({station:1,pager:2,action:2,stationBits:10,pagerBits:10,actionBits:4,reverseFields:false,te:212,frames:1});assert.equal(e.logical,"000000000100000000100010");});
test("TD174-style payload supports 13/2/8 plus trailing zero",()=>{const e=encodeRetekessPrinceton({station:1,pager:2,action:0,stationBits:13,pagerBits:8,actionBits:2,reverseFields:true,te:326,trailingBit:"0",frames:1});assert.equal(e.logical.length,24);});

test("T112 RX decodes generated frame at arbitrary bit offset",()=>{const e=encodeRetekessT112({systemId:321,pagerId:69,cancel:false,frames:1});const prefixed=new Uint8Array(e.bytes.length+1);prefixed[0]=0x55;prefixed.set(e.bytes,1);const d=decodeRetekessT112(prefixed);assert.equal(d.fields.systemId,321);assert.equal(d.fields.pagerId,69);assert.equal(d.fields.cancel,false);});
test("T119-style RX recovers station pager and action",()=>{const e=encodeRetekessPrinceton({station:123,pager:45,action:1,frames:1});const d=decodeRetekessPrinceton(e.bytes);assert.deepEqual(d.fields,{station:123,pager:45,action:1});});
test("TD157-style RX recovers MSB-first fields",()=>{const e=encodeRetekessPrinceton({station:12,pager:34,action:2,stationBits:10,pagerBits:10,actionBits:4,reverseFields:false,te:212,frames:1});const d=decodeRetekessPrinceton(e.bytes,{stationBits:10,pagerBits:10,actionBits:4,reverseFields:false});assert.deepEqual(d.fields,{station:12,pager:34,action:2});});
test("TD164 RX validates checksums and decodes pager",()=>{const e=encodeRetekessTd164({pagerId:321,sequenceNumber:4,functionCode:1,frames:1});const d=decodeRetekessTd164(e.bytes);assert.equal(d.fields.pagerId,321);assert.equal(d.fields.sequence,4);assert.equal(d.fields.function,1);});

test("TD161 RX recovers BCD system pager and function",()=>{const e=encodeRetekessTd161({systemId:321,pagerId:69,alertType:2,frames:1});const d=decodeRetekessTd161(e.bytes);assert.deepEqual(d.fields,{systemId:321,pagerId:69,alertType:2});});
test("TD161 RX searches across an arbitrary byte offset",()=>{const e=encodeRetekessTd161({systemId:42,pagerId:7,alertType:1,frames:1});const b=new Uint8Array(e.bytes.length+1);b[0]=0xaa;b.set(e.bytes,1);const d=decodeRetekessTd161(b);assert.deepEqual(d.fields,{systemId:42,pagerId:7,alertType:1});});
