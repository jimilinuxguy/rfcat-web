import test from "node:test";
import assert from "node:assert/strict";

import { RFCatUSB } from "../js/rfcat/device.js";

function harness(reads = {}) {
    const d = new RFCatUSB();
    const writes = [];
    const modes = [];

    d.peek = async (addr, count = 1) => {
        const value = reads[addr];
        if (value instanceof Uint8Array) return value;
        if (Array.isArray(value)) return new Uint8Array(value);
        return new Uint8Array(count).fill(value ?? 0);
    };
    d.poke = async (addr, data) => {
        writes.push([addr, [...data]]);
    };
    d.mode = async (mode) => {
        modes.push(mode);
    };

    return { d, writes, modes };
}

test("setDeviation(4500) writes independently expected DEVIATN encoding", async () => {
    const { d, writes } = harness();
    const actual = await d.setDeviation(4500);

    assert.deepEqual(writes, [[0xdf11, [0x14]]]);
    assert.equal(actual, 4394.53125);
});

test("setDataRate(512) writes the expected modem exponent and mantissa", async () => {
    const { d, writes } = harness({ 0xdf0c: 0xc0 });
    await d.setDataRate(512);

    assert.deepEqual(writes, [
        [0xdf0d, [0x66]],
        [0xdf0c, [0xc4]],
    ]);
});

test("setFrequency(457.6 MHz) idles then writes expected synthesizer bytes", async () => {
    const { d, writes, modes } = harness();
    await d.setFrequency(457_600_000);

    assert.equal(modes.length, 1);
    assert.deepEqual(writes, [
        [0xdf09, [0x13, 0x11, 0x11]],
        [0xdf1d, [0x2a]],
    ]);
});

test("setModulation changes only MDMCFG2 modulation-format bits", async () => {
    const { d, writes } = harness({ 0xdf0e: 0x0b });
    await d.setModulation(0x30);
    assert.deepEqual(writes, [[0xdf0e, [0x3b]]]);
});

test("setManchester preserves other MDMCFG2 fields", async () => {
    const { d, writes } = harness({ 0xdf0e: 0x31 });
    await d.setManchester(true);
    assert.deepEqual(writes, [[0xdf0e, [0x39]]]);
});

test("setSync writes SYNC1/SYNC0 consecutively and preserves modulation", async () => {
    const { d, writes } = harness({ 0xdf0e: 0x38 });
    await d.setSync(0x832d, 3);

    assert.deepEqual(writes, [
        [0xdf00, [0x83, 0x2d]],
        [0xdf0e, [0x3b]],
    ]);
});

test("fixed packet configuration writes exact packet-engine registers", async () => {
    const { d, writes } = harness({ 0xdf04: 0x40, 0xdf03: 0x40 });
    await d.setPacketConfig({
        lengthMode: "fixed",
        packetLength: 140,
        crc: false,
        whitening: false,
        appendStatus: false,
        addressCheck: 0,
        deviceAddress: 0,
    });

    assert.deepEqual(writes, [
        [0xdf02, [140]],
        [0xdf05, [0]],
        [0xdf04, [0x00]],
        [0xdf03, [0x40]],
    ]);
});

test("variable packet configuration encodes whitening CRC status and address check", async () => {
    const { d, writes } = harness({ 0xdf04: 0x20, 0xdf03: 0xa0 });
    await d.setPacketConfig({
        lengthMode: "variable",
        packetLength: 64,
        crc: true,
        whitening: true,
        appendStatus: true,
        addressCheck: 2,
        deviceAddress: 0x42,
    });

    assert.deepEqual(writes, [
        [0xdf02, [64]],
        [0xdf05, [0x42]],
        [0xdf04, [0x65]],
        [0xdf03, [0xa6]],
    ]);
});

test("config decodes known CC1111 register image", async () => {
    const image = new Uint8Array(0x3e);
    image[0] = 0x83;
    image[1] = 0x2d;
    image[2] = 140;
    image[3] = 0x40;
    image[4] = 0x00;
    image[5] = 0x00;
    image[9] = 0x13;
    image[10] = 0x11;
    image[11] = 0x11;
    image[12] = 0xc4;
    image[13] = 0x66;
    image[14] = 0x00;
    image[0x3b] = 0x01;

    const { d } = harness({ 0xdf00: image });
    const c = await d.config();

    assert.ok(Math.abs(c.freq - 457_599_975.5859375) < 1);
    assert.ok(Math.abs(c.rate - 512.1231079101562) < 0.001);
    assert.equal(c.bw, 58_593.75);
    assert.equal(c.mod, 0x00);
    assert.equal(c.sync, 0x832d);
    assert.equal(c.packetLength, 140);
    assert.equal(c.lengthMode, "fixed");
    assert.equal(c.marc, 1);
});
