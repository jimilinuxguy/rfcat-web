import test from "node:test";
import assert from "node:assert/strict";
import { R } from "../js/radio/registers.js";
import { RFCatUSB } from "../js/rfcat/device.js";

test("CC1111 synthesizer and FSCTRL1 register addresses are distinct and correct", () => {
    assert.equal(R.FREQ2, 0xdf09);
    assert.equal(R.FREQ1, 0xdf0a);
    assert.equal(R.FREQ0, 0xdf0b);
    assert.equal(R.FSCTRL1, 0xdf07);
});

test("433.920 MHz programs each synthesizer byte and verifies readback", async () => {
    const radio = new RFCatUSB();
    const writes = [];
    radio.mode = async () => {};
    radio.poke = async (addr, data) => { writes.push([addr, ...data]); };
    radio.peek = async (addr, count) => {
        assert.equal(addr, R.FREQ2);
        assert.equal(count, 3);
        return Uint8Array.from(writes.slice(0, 3).map(entry => entry[1]));
    };
    await radio.setFrequency(433.92e6);
    assert.deepEqual(writes.slice(0, 3), [
        [R.FREQ2, 0x12],
        [R.FREQ1, 0x14],
        [R.FREQ0, 0x7a],
    ]);
    assert.equal(writes[3][0], R.FSCAL2);
});

test("frequency readback mismatch fails rather than silently transmitting off-frequency", async () => {
    const radio = new RFCatUSB();
    radio.mode = async () => {};
    radio.poke = async () => {};
    radio.peek = async () => Uint8Array.from([0x12, 0x14, 0x06]);
    await assert.rejects(radio.setFrequency(433.92e6), /Frequency register write failed/);
});
