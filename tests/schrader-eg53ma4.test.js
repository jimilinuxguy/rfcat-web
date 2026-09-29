import test from "node:test";
import assert from "node:assert/strict";

import {
    SCHRADER_EG53MA4_HALF_BIT_US,
    SCHRADER_EG53MA4_SYMBOL_RATE,
    buildSchraderEg53ma4Packet,
    buildSchraderEg53ma4LogicalFrame,
    encodeSchraderEg53ma4Manchester,
    schraderEg53ma4Checksum,
} from "../js/protocols/schrader-eg53ma4.js";

test("EG53MA4 builds the Silverado capture payload", () => {
    const packet = buildSchraderEg53ma4Packet({
        flags: 0x4c900010,
        id: 0x00c169,
        pressureKPa: 237.5,
        temperatureF: 93,
    });
    assert.deepEqual([...packet.bytes], [0x4c, 0x90, 0x00, 0x10, 0x00, 0xc1, 0x69, 0x5f, 0x5d, 0xd2]);
    assert.equal(packet.pressureRaw, 95);
    assert.equal(packet.checksum, 0xd2);
});

test("EG53MA4 checksum is byte sum modulo 256", () => {
    const data = Uint8Array.from([0x4c, 0x90, 0x00, 0x10, 0x00, 0xc1, 0x69, 0x5f, 0x5d]);
    assert.equal(schraderEg53ma4Checksum(data), 0xd2);
});

test("EG53MA4 logical frame is exactly 120 decoded bits", () => {
    const packet = buildSchraderEg53ma4Packet();
    const bits = buildSchraderEg53ma4LogicalFrame(packet.bytes);
    assert.equal(bits.length, 120);
    assert.equal(bits.slice(0, 40), "0".repeat(40));
});

test("EG53MA4 Manchester candidate produces 240 RF half-symbols", () => {
    const packet = buildSchraderEg53ma4Packet();
    const bits = buildSchraderEg53ma4LogicalFrame(packet.bytes);
    const rf = encodeSchraderEg53ma4Manchester(bits);
    assert.equal(rf.symbols, 240);
    assert.equal(rf.bytes.length, 30);
    assert.equal(rf.padding, 0);
    assert.equal(SCHRADER_EG53MA4_HALF_BIT_US, 123);
});


test("EG53MA4 TX waveform is exactly 30 bytes with no padding", () => {
    const packet = buildSchraderEg53ma4Packet();
    const bits = buildSchraderEg53ma4LogicalFrame(packet.bytes);
    const rf = encodeSchraderEg53ma4Manchester(bits);
    assert.equal(bits.length, 120);
    assert.equal(rf.symbols, 240);
    assert.equal(rf.bytes.length, 30);
    assert.equal(rf.padding, 0);
});

test("EG53MA4 nominal half-bit rate is derived from 123 us", () => {
    assert.ok(Math.abs(SCHRADER_EG53MA4_SYMBOL_RATE - (1_000_000 / 123)) < 1e-9);
});
