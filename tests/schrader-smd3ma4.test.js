import test from "node:test";
import assert from "node:assert/strict";
import { SCHRADER_SMD3MA4_PREAMBLE, buildSchraderSmd3ma4LogicalFrame, encodeSchraderSmd3ma4Waveform, schraderSmd3ma4Integrity, schraderSmd3ma4, schraderNis315g3 } from "../js/protocols/schrader-smd3ma4.js";

test("SMD3MA4 preamble is exactly 0xF5555555E", () => {
    assert.equal(SCHRADER_SMD3MA4_PREAMBLE.length, 36);
    assert.equal(BigInt("0b" + SCHRADER_SMD3MA4_PREAMBLE), 0xF5555555En);
});

test("SMD3MA4 builds 38 decoded bits with valid 2-bit-group integrity", () => {
    const frame = buildSchraderSmd3ma4LogicalFrame({ id: 0x98e08e, flags: 6, pressureRaw: 180 });
    assert.equal(frame.bits.length, 38);
    assert.equal(frame.bits[0], "1");
    const padded = frame.bits + "00";
    let sum = 0;
    for (let i = 0; i < 40; i += 2) sum += Number.parseInt(padded.slice(i, i + 2), 2);
    assert.equal(sum & 3, 1);
    assert.equal(frame.integrity, schraderSmd3ma4Integrity(frame.bits.slice(0, 36)));
});

test("SMD3MA4 waveform is 36-bit preamble plus 37 Manchester bits", () => {
    const frame = buildSchraderSmd3ma4LogicalFrame();
    const rf = encodeSchraderSmd3ma4Waveform(frame.bits);
    assert.equal(rf.waveform.startsWith(SCHRADER_SMD3MA4_PREAMBLE), true);
    assert.equal(rf.symbols, 110);
    assert.equal(rf.bytes.length, 14);
    assert.equal(rf.padding, 2);
});

test("Subaru and Nissan variants share wire format but use different pressure scales", () => {
    const common = { frequency: 315, id: "98E08E", flags: "6", pressurePsi: 10 };
    const subaru = schraderSmd3ma4.encode(common);
    const nissan = schraderNis315g3.encode(common);
    assert.equal(subaru.pressureRaw, 50);
    assert.equal(nissan.pressureRaw, 40);
    assert.notEqual(subaru.bits, nissan.bits);
});

test("SMD3MA4 protocol TX adds a 480 us LOW reset tail", () => {
    const encoded = schraderSmd3ma4.encode({ frequency: 315, id: "98E08E", flags: "6", pressurePsi: 10.4 });
    assert.equal(encoded.waveform.length, 110);
    assert.equal(encoded.bytes.length, 15);
});
