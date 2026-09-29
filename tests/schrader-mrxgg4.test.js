import test from "node:test";
import assert from "node:assert/strict";
import { buildSchraderMrxgg4Packet, schraderCrc8 } from "../js/protocols/schrader-mrxgg4.js";

test("Schrader MRXGG4 matches rtl_433 known packet", () => {
    const result = buildSchraderMrxgg4Packet({
        flags: 0x67,
        id: 0x03a38b2,
        pressureKPa: 0,
        temperatureC: 23,
    });
    assert.deepEqual([...result.bytes], [0xf6,0x70,0x3a,0x38,0xb2,0x00,0x49,0x49]);
});

test("Schrader CRC known answer", () => {
    const data = Uint8Array.from([0xf6,0x70,0x3a,0x38,0xb2,0x00,0x49]);
    assert.equal(schraderCrc8(data), 0x49);
});

test("Schrader fields round-trip through packet layout", () => {
    const r = buildSchraderMrxgg4Packet({ id:0x0abcdef, flags:0x12, pressureKPa:225, temperatureC:30 });
    const b=r.bytes;
    const flags=((b[0]&0x0f)<<4)|(b[1]>>4);
    const id=((b[1]&0x0f)<<24)|(b[2]<<16)|(b[3]<<8)|b[4];
    assert.equal(flags,0x12); assert.equal(id,0x0abcdef);
    assert.equal(b[5]*2.5,225); assert.equal(b[6]-50,30);
    assert.equal(b[7], schraderCrc8(b.subarray(0,7)));
});

test("Schrader rejects out-of-range fields", () => {
    assert.throws(()=>buildSchraderMrxgg4Packet({id:0x10000000}), /28-bit/);
    assert.throws(()=>buildSchraderMrxgg4Packet({pressureKPa:640}), /Pressure/);
    assert.throws(()=>buildSchraderMrxgg4Packet({temperatureC:206}), /Temperature/);
});

import {
    buildSchraderMrxgg4LogicalFrame,
    encodeSchraderMrxgg4Manchester,
    decodeSchraderMrxgg4Manchester,
    SCHRADER_MRXGG4_SYMBOL_RATE,
} from "../js/protocols/schrader-mrxgg4.js";

test("Schrader builds the rtl_433 68-bit logical frame", () => {
    const packet = buildSchraderMrxgg4Packet({
        flags: 0x67, id: 0x03a38b2, pressureKPa: 0, temperatureC: 23,
    });
    const bits = buildSchraderMrxgg4LogicalFrame(packet.bytes);
    assert.equal(bits.length, 68);
    assert.equal(bits.slice(0, 4), "0111");
    assert.equal(bits.slice(4), "1111011001110000001110100011100010110010000000000100100101001001");
});

test("Schrader validated Manchester encoding is 136 RF symbols and round-trips", () => {
    const packet = buildSchraderMrxgg4Packet({
        flags: 0x67, id: 0x03a38b2, pressureKPa: 0, temperatureC: 23,
    });
    const bits = buildSchraderMrxgg4LogicalFrame(packet.bytes);
    const rf = encodeSchraderMrxgg4Manchester(bits);
    assert.equal(rf.symbols, 136);
    assert.equal(rf.bytes.length, 17);
    assert.equal(rf.padding, 0);
    assert.equal(rf.waveform.slice(0, 8), "01101010"); // logical sync 0111
    assert.equal(decodeSchraderMrxgg4Manchester(rf.waveform), bits);
});

test("Schrader validated Manchester polarity is 0→01 and 1→10", () => {
    assert.equal(encodeSchraderMrxgg4Manchester("0").waveform, "01");
    assert.equal(encodeSchraderMrxgg4Manchester("1").waveform, "10");
    assert.equal(encodeSchraderMrxgg4Manchester("0111").waveform, "01101010");
    assert.throws(() => decodeSchraderMrxgg4Manchester("00"), /Invalid Manchester pair/);
});

test("Schrader nominal half-bit rate is 8333.33 symbols per second", () => {
    assert.ok(Math.abs(SCHRADER_MRXGG4_SYMBOL_RATE - 8333.333333333334) < 1e-9);
});
