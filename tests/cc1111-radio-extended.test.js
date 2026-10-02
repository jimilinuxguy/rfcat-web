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
    d.poke = async (addr, data) => writes.push([addr, [...data]]);
    d.mode = async (mode) => modes.push(mode);
    return { d, writes, modes };
}

test("frequency synthesis uses known CC1111 register vectors across supported bands", async () => {
    const cases = [
        [315_000_000, [0x0d, 0x1f, 0xff], 0x0a],
        [390_000_000, [0x10, 0x40, 0x00], 0x0a],
        [433_920_000, [0x12, 0x14, 0x7a], 0x2a],
        [457_600_000, [0x13, 0x11, 0x11], 0x2a],
        [868_000_000, [0x24, 0x2a, 0xaa], 0x2a],
        [902_000_000, [0x25, 0x95, 0x55], 0x2a],
        [915_000_000, [0x26, 0x1f, 0xff], 0x2a],
    ];

    for (const [hz, freqBytes, fscal2] of cases) {
        const { d, writes, modes } = harness();
        await d.setFrequency(hz);
        assert.deepEqual(modes, [0x04], `${hz} must enter RF_IDLE`);
        assert.deepEqual(writes, [
            [0xdf09, freqBytes],
            [0xdf1d, [fscal2]],
        ], `unexpected frequency programming for ${hz}`);
    }
});

test("FSCAL2 calibration boundaries preserve RFCat behavior", async () => {
    const cases = [
        [317_999_999, 0x0a],
        [318_000_000, 0x2a],
        [369_000_000, 0x2a],
        [369_000_001, 0x0a],
        [423_999_999, 0x0a],
        [424_000_000, 0x2a],
        [615_000_000, 0x2a],
        [615_000_001, 0x0a],
        [847_999_999, 0x0a],
        [848_000_000, 0x2a],
    ];

    for (const [hz, expected] of cases) {
        const { d, writes } = harness();
        await d.setFrequency(hz);
        assert.equal(writes[1][0], 0xdf1d);
        assert.equal(writes[1][1][0], expected, `wrong FSCAL2 at ${hz}`);
    }
});

test("data-rate programming preserves MDMCFG4 bandwidth bits", async () => {
    for (const rate of [512, 625, 1200, 2400, 2500, 8333.333]) {
        const { d, writes } = harness({ 0xdf0c: 0xb0 });
        await d.setDataRate(rate);
        assert.equal(writes[1][0], 0xdf0c);
        assert.equal(writes[1][1][0] & 0xf0, 0xb0);
    }
});

test("unsupported data rates fail instead of writing partial modem state", async () => {
    for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const { d, writes } = harness({ 0xdf0c: 0 });
        await assert.rejects(() => d.setDataRate(rate), /Unsupported data rate/);
        assert.deepEqual(writes, []);
    }
});

test("bandwidth quantization preserves data-rate exponent", async () => {
    const { d, writes } = harness({ 0xdf0c: 0x07 });
    const actual = await d.setBandwidth(100_000);
    assert.equal(actual, 93_750);
    assert.deepEqual(writes, [[0xdf0c, [0xc7]]]);
});

test("bandwidth quantizer reaches all 16 legal CC1111 bandwidth encodings", async () => {
    const seen = new Set();
    for (let e = 0; e < 4; e++) {
        for (let m = 0; m < 4; m++) {
            const target = 24_000_000 / (8 * (4 + m) * (2 ** e));
            const { d, writes } = harness({ 0xdf0c: 0x0a });
            const actual = await d.setBandwidth(target);
            assert.equal(actual, target);
            const value = writes[0][1][0];
            assert.equal(value & 0x0f, 0x0a);
            seen.add(value & 0xf0);
        }
    }
    assert.equal(seen.size, 16);
});

test("deviation quantization round-trips through the CC1111 formula", async () => {
    for (const requested of [1_500, 4_500, 15_000, 20_500, 50_000, 100_000]) {
        const { d, writes } = harness();
        const actual = await d.setDeviation(requested);
        const reg = writes[0][1][0];
        const e = (reg >> 4) & 7;
        const m = reg & 7;
        const decoded = ((8 + m) * (2 ** e) * 24_000_000) / (2 ** 17);
        assert.equal(writes[0][0], 0xdf11);
        assert.equal(actual, decoded);
    }
});

test("FSK max-power setup uses PA_TABLE0 and PA_POWER zero", async () => {
    const { d, writes } = harness({ 0xdf1b: 0x17 });
    d.config = async () => ({ freq: 457_600_000, mod: 0x00 });

    const power = await d.setMaxPower();

    assert.equal(power, 0xc0);
    assert.deepEqual(writes, [
        [0xdf2e, [0xc0]],
        [0xdf2d, [0x00]],
        [0xdf1b, [0x10]],
    ]);
});

test("OOK max-power setup uses PA_TABLE1 and PA_POWER one", async () => {
    const { d, writes } = harness({ 0xdf1b: 0x16 });
    d.config = async () => ({ freq: 433_920_000, mod: 0x30 });

    const power = await d.setMaxPower();

    assert.equal(power, 0xc0);
    assert.deepEqual(writes, [
        [0xdf2e, [0x00]],
        [0xdf2d, [0xc0]],
        [0xdf1b, [0x11]],
    ]);
});

test("PA power table selection follows RFCat frequency bands", async () => {
    const cases = [
        [315_000_000, 0xc2],
        [400_000_000, 0xc2],
        [400_000_001, 0xc0],
        [464_000_000, 0xc0],
        [464_000_001, 0xc2],
        [900_000_000, 0xc2],
        [900_000_001, 0xc0],
    ];
    for (const [freq, expected] of cases) {
        const { d } = harness({ 0xdf1b: 0 });
        d.config = async () => ({ freq, mod: 0x00 });
        assert.equal(await d.setMaxPower(), expected);
    }
});

test("configureAskOokPa writes PATABLE burst and preserves FREND0 upper bits", async () => {
    const { d, writes } = harness({ 0xdf1b: 0xb6 });
    await d.configureAskOokPa();
    assert.deepEqual(writes, [
        [0xdf2d, [0xc0, 0, 0, 0, 0, 0, 0, 0]],
        [0xdf1b, [0xb1]],
    ]);
});

test("continuous carrier preserves packet fields outside PKT_FORMAT", async () => {
    const { d, writes, modes } = harness({ 0xdf04: 0xc7 });
    await d.startContinuousCarrier();
    assert.deepEqual(modes, [0x04, 0x03]);
    assert.deepEqual(writes, [[0xdf04, [0xe7]]]);
});

test("lowball matches upstream RFCat default register semantics", async () => {
    const { d, writes } = harness({
        0xdf04: 0x77,
        0xdf0f: 0x95,
        0xdf03: 0xe6,
        0xdf0e: 0x3b,
    });

    await d.lowball();

    assert.deepEqual(writes, [
        [0xdf02, [0xfa]],
        [0xdf04, [0x30]],
        [0xdf0f, [0x15]],
        [0xdf00, [0xaa, 0xaa]],
        [0xdf03, [0x06]],
        [0xdf0e, [0x3c]],
    ]);
});

test("setTxPaPower uses verified FREND0 and preserves unrelated bits", async () => {
    const { d, writes } = harness({ 0xdf1b: 0xae });
    await d.setTxPaPower();
    assert.deepEqual(writes, [[0xdf1b, [0xa9]]]);
});
