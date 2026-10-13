import test from "node:test";
import assert from "node:assert/strict";
import {encodeRecord,parseIntelHex,validateFirmware} from "../js/firmware/intel-hex.js";
import {BootloaderProtocol,COMMANDS,readCommand,pageEraseCommand} from "../js/firmware/bootloader-protocol.js";
import {readApplication,compareApplication,exportApplicationHex,BACKUP_BYTES,verifyImageAgainstDevice} from "../js/firmware/backup.js";
import {MockBootloaderTransport} from "../js/firmware/mock-transport.js";
const sample=encodeRecord(0,0x1400,Array.from({length:16},(_,i)=>i))+ "\n"+encodeRecord(1,0);
test("Intel HEX parses valid records, checksum and EOF",()=>{
 const image=parseIntelHex(sample);assert.equal(image.bytes,16);assert.equal(image.min,0x1400);assert.equal(validateFirmware(image).records.length,1);
 assert.throws(()=>parseIntelHex(sample.replace("000102","000103")),/checksum/);
 assert.throws(()=>parseIntelHex(sample.replace(/:00000001FF/,"")),/EOF/);
});
test("firmware protects bootloader, upper flash and overlapping records",()=>{
 assert.throws(()=>validateFirmware(parseIntelHex(encodeRecord(0,0x13f0,Array(16).fill(0))+"\n"+encodeRecord(1,0))),/bootloader/);
 assert.throws(()=>validateFirmware(parseIntelHex(encodeRecord(0,0x8000,Array(16).fill(0))+"\n"+encodeRecord(1,0))),/exceeds/);
 assert.throws(()=>parseIntelHex(encodeRecord(0,0x1400,[1])+"\n"+encodeRecord(0,0x1400,[2])+"\n"+encodeRecord(1,0)),/overlap/);
});
test("protocol matches upstream custom Intel HEX commands",()=>{
 assert.equal(COMMANDS.eraseAll,":00000023DD");assert.equal(COMMANDS.reset,":00000022DE");assert.equal(COMMANDS.run,":00000001FF");
 assert.equal(readCommand(0x1400,16),":021400250010B5");assert.throws(()=>pageEraseCommand(4),/Protected/);
});
test("mock flash performs erase, write and readback verification",async()=>{
 const mock=new MockBootloaderTransport(),protocol=new BootloaderProtocol(mock),plan=validateFirmware(parseIntelHex(sample));
 const events=[];await protocol.flash(plan,x=>events.push(x.phase));
 assert.equal(mock.flash[0x1401],1);assert.equal(events.at(-1),"verified");
 mock.flash[0x1401]=0xff;await assert.rejects(protocol.verify(plan),/mismatch/);
});
test("transport failures never yield verified state",async()=>{
 const mock=new MockBootloaderTransport(),protocol=new BootloaderProtocol(mock);
 mock.fail=true;await assert.rejects(protocol.flash(validateFirmware(parseIntelHex(sample))),/Injected/);
});

test("read-only bootloader probe returns application bytes without mutation",async()=>{
 const mock=new MockBootloaderTransport();
 mock.flash.set([0x12,0x34,0x56,0x78],0x1400);
 const before=mock.flash.slice();
 const data=await new BootloaderProtocol(mock).read(0x1400,16);
 assert.deepEqual(Array.from({length:4},(_,i)=>data.get(0x1400+i)),[0x12,0x34,0x56,0x78]);
 assert.deepEqual(mock.flash,before);
});

test("full application backup roundtrips as restorable Intel HEX without modifying flash",async()=>{
 const mock=new MockBootloaderTransport();
 mock.flash[0x1400]=0x02;mock.flash[0x1401]=0x14;mock.flash[0x7fff]=0x55;
 const before=mock.flash.slice();
 const protocol=new BootloaderProtocol(mock);
 const progress=[];
 const first=await readApplication(protocol,p=>progress.push(p));
 const second=await readApplication(protocol);
 assert.equal(first.length,BACKUP_BYTES);
 assert.equal(progress.at(-1),1);
 assert.equal(compareApplication(first,second),true);
 const image=parseIntelHex(exportApplicationHex(first));
 assert.equal(image.bytes,BACKUP_BYTES);
 assert.equal(image.memory.get(0x1400),0x02);
 assert.equal(image.memory.get(0x7fff),0x55);
 assert.ok(validateFirmware(image).records.length>0);
 assert.deepEqual(mock.flash,before);
 second[0]^=1;
 assert.throws(()=>compareApplication(first,second),/mismatch at 0x1400/);
});
test("failed backup read never returns a complete image",async()=>{
 const mock=new MockBootloaderTransport();
 mock.fail=true;
 await assert.rejects(readApplication(new BootloaderProtocol(mock)),/Injected/);
});

test("device verification compares full flash to uploaded HEX without writes",async()=>{
 const mock=new MockBootloaderTransport();
 mock.flash[0x1400]=0x02;mock.flash[0x1401]=0x14;mock.flash[0x7fff]=0x55;
 const before=mock.flash.slice();
 const image=parseIntelHex(exportApplicationHex(await readApplication(new BootloaderProtocol(mock))));
 const progress=[];
 assert.equal(await verifyImageAgainstDevice(new BootloaderProtocol(mock),image,p=>progress.push(p)),BACKUP_BYTES);
 assert.equal(progress.at(-1),1);
 assert.deepEqual(mock.flash,before);
 mock.flash[0x1401]^=1;
 await assert.rejects(verifyImageAgainstDevice(new BootloaderProtocol(mock),image),/mismatch at 0x1401/);
});
test("sparse HEX verification requires omitted flash bytes to be erased",async()=>{
 const mock=new MockBootloaderTransport();
 mock.flash[0x1400]=0x02;
 const image=parseIntelHex(encodeRecord(0,0x1400,[0x02,...Array(15).fill(255)])+"\n"+encodeRecord(1,0));
 assert.equal(await verifyImageAgainstDevice(new BootloaderProtocol(mock),image),BACKUP_BYTES);
 mock.flash[0x140f]=0x00;
 await assert.rejects(verifyImageAgainstDevice(new BootloaderProtocol(mock),image),/mismatch at 0x140f/);
});

test("post-flash full-region verification passes and detects unwritten-region corruption",async()=>{
 const mock=new MockBootloaderTransport(),protocol=new BootloaderProtocol(mock);
 const image=parseIntelHex(sample),plan=validateFirmware(image);
 await protocol.flash(plan);
 assert.equal(await verifyImageAgainstDevice(protocol,image),BACKUP_BYTES);
 mock.flash[0x2000]=0x42;
 await assert.rejects(verifyImageAgainstDevice(protocol,image),/mismatch at 0x2000/);
});
