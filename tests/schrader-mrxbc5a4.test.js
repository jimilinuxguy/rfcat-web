import test from "node:test";
import assert from "node:assert/strict";
import { SCHRADER_MRXBC5A4_PREFIX, buildSchraderMrxbc5a4LogicalFrame, encodeSchraderMrxbc5a4Manchester, schraderMrxbc5a4Integrity } from "../js/protocols/schrader-mrxbc5a4.js";

test("MRXBC5A4 builds the decoder-effective 61-bit frame", () => {
    const frame = buildSchraderMrxbc5a4LogicalFrame({ flags: 2, id: 0x224015, pressureKPa: 249, temperatureC: 20 });
    assert.equal(frame.bits.length, 61);
    assert.equal(frame.bits.slice(0, 16), SCHRADER_MRXBC5A4_PREFIX);
    assert.equal(frame.bits.slice(16, 19), "010");
});

test("MRXBC5A4 integrity satisfies rtl_433 formula", () => {
    const id = 0x224015, pressure = 249;
    const c = schraderMrxbc5a4Integrity(id, pressure);
    const payload = id.toString(2).padStart(24,"0") + pressure.toString(2).padStart(9,"0") + c.toString(2).padStart(2,"0");
    let even = 0, n = 0;
    for (let i=0;i<payload.length;i++) if(payload[i]==="1") { n++; if((i&1)===0) even++; }
    assert.equal((even + 2*n - 1) & 3, c);
});

test("MRXBC5A4 Manchester encoding produces 122 half-symbols", () => {
    const frame = buildSchraderMrxbc5a4LogicalFrame();
    const rf = encodeSchraderMrxbc5a4Manchester(frame.bits);
    assert.equal(rf.symbols, 122);
    assert.equal(rf.bytes.length, 16);
    assert.equal(rf.padding, 6);
});
