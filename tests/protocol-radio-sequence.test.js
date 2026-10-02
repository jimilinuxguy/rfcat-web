import test from "node:test";
import assert from "node:assert/strict";

import pocsag from "../js/protocols/pocsag.js";
import jtech from "../js/protocols/jtech.js";
import lrs from "../js/protocols/lrs.js";
import tesla from "../js/protocols/tesla.js";

function recorder({ failTransmit = false } = {}) {
    const calls = [];
    const device = new Proxy({}, {
        get(_target, prop) {
            if (prop === "calls") return calls;
            return async (...args) => {
                calls.push([prop, ...args]);
                if (prop === "transmit" && failTransmit) throw new Error("TX failed");
            };
        },
    });
    return device;
}

function names(device) {
    return device.calls.map(([name]) => name);
}

test("POCSAG configuration programs modem fields in deliberate order", async () => {
    const d = recorder();
    await pocsag.configure(d, {
        frequency: 457_600_000,
        baud: 512,
        deviation: 4_500,
    });

    assert.deepEqual(names(d), [
        "mode", "setFrequency", "setModulation", "setDataRate",
        "setDeviation", "setSync", "setManchester", "setMaxPower",
    ]);
    assert.deepEqual(d.calls[0], ["mode", 0x04]);
    assert.deepEqual(d.calls[1], ["setFrequency", 457_600_000]);
    assert.deepEqual(d.calls[2], ["setModulation", 0x00]);
    assert.deepEqual(d.calls[3], ["setDataRate", 512]);
    assert.deepEqual(d.calls[4], ["setDeviation", 4_500]);
});

test("POCSAG TX refreshes PA immediately before diagnostics and amplifier enable", async () => {
    const d = recorder();
    const encoded = { bytes: new Uint8Array([1, 2, 3]) };
    await pocsag.transmit(d, encoded, { repeat: 2, offset: 1 });

    assert.deepEqual(names(d), [
        "setPacketConfig", "setMaxPower", "logTxDiagnostics",
        "setAmpMode", "transmit", "transmit", "transmit", "setAmpMode",
    ]);
    assert.deepEqual(d.calls[3], ["setAmpMode", true]);
    assert.deepEqual(d.calls.slice(4, 7), [
        ["transmit", encoded.bytes, 0, 1],
        ["transmit", encoded.bytes, 0, 1],
        ["transmit", encoded.bytes, 0, 1],
    ]);
    assert.deepEqual(d.calls[7], ["setAmpMode", false]);
});

test("POCSAG TX always disables amplifier when NIC_XMIT fails", async () => {
    const d = recorder({ failTransmit: true });
    const encoded = { bytes: new Uint8Array([1]) };
    await assert.rejects(() => pocsag.transmit(d, encoded, {}), /TX failed/);
    assert.deepEqual(d.calls.at(-1), ["setAmpMode", false]);
});

test("JTECH configuration has fixed 512-baud 4.5-kHz FSK contract", async () => {
    const d = recorder();
    await jtech.configure(d, { frequency: 457_600_000 });
    assert.deepEqual(d.calls, [
        ["mode", 0x04],
        ["setFrequency", 457_600_000],
        ["setModulation", 0x00],
        ["setDataRate", 512],
        ["setDeviation", 4_500],
        ["setSync", 0x0000, 0],
        ["setManchester", false],
        ["setMaxPower"],
    ]);
});

test("LRS configuration has fixed RF parameters and hardware Manchester", async () => {
    const d = recorder();
    await lrs.configure(d);
    assert.deepEqual(d.calls, [
        ["mode", 0x04],
        ["setFrequency", 467_750_000],
        ["setModulation", 0x00],
        ["setDataRate", 625],
        ["setDeviation", 15_000],
        ["setSync", 0x0000, 0],
        ["setManchester", true],
        ["setMaxPower"],
    ]);
});

test("JTECH and LRS refresh FSK PA state before each transmit", async () => {
    for (const protocol of [jtech, lrs]) {
        const d = recorder();
        const encoded = { bytes: new Uint8Array([0xaa, 0x55]) };
        await protocol.transmit(d, encoded, { repeat: 0, offset: 0 });
        const n = names(d);
        assert.deepEqual(n.slice(0, 4), [
            "setPacketConfig", "setMaxPower", "logTxDiagnostics", "setAmpMode",
        ]);
        assert.equal(n[4], "transmit");
        assert.deepEqual(d.calls.at(-1), ["setAmpMode", false]);
    }
});

test("Tesla configuration establishes ASK/OOK modem contract", async () => {
    const d = recorder();
    await tesla.configure(d, { frequency: 433_920_000 });
    assert.deepEqual(d.calls, [
        ["mode", 0x04],
        ["setFrequency", 433_920_000],
        ["setModulation", 0x30],
        ["setDataRate", 2500],
        ["setSync", 0x0000, 0],
        ["setManchester", false],
    ]);
});

test("Tesla TX configures OOK PA before amplifier and always returns to idle", async () => {
    const d = recorder();
    const encoded = { bytes: new Uint8Array([1, 2]) };
    await tesla.transmit(d, encoded);
    assert.deepEqual(names(d), [
        "configureAskOokPa", "setAmpMode", "transmit", "mode", "setAmpMode",
    ]);
    assert.deepEqual(d.calls[1], ["setAmpMode", true]);
    assert.deepEqual(d.calls[2], ["transmit", encoded.bytes, 0, 0]);
    assert.deepEqual(d.calls[3], ["mode", 0x04]);
    assert.deepEqual(d.calls[4], ["setAmpMode", false]);
});

test("Tesla TX cleanup runs after transmit failure", async () => {
    const d = recorder({ failTransmit: true });
    await assert.rejects(
        () => tesla.transmit(d, { bytes: new Uint8Array([1]) }),
        /TX failed/,
    );
    assert.deepEqual(d.calls.slice(-2), [
        ["mode", 0x04],
        ["setAmpMode", false],
    ]);
});

test("pager repeat count is implemented host-side for every FSK pager protocol", async () => {
    for (const protocol of [pocsag, jtech, lrs]) {
        const d = recorder();
        const encoded = { bytes: new Uint8Array([0xaa]) };
        await protocol.transmit(d, encoded, { repeat: 4, offset: 7 });
        const tx = d.calls.filter(([name]) => name === "transmit");
        assert.equal(tx.length, 5);
        assert.deepEqual(tx, Array.from({ length: 5 }, () =>
            ["transmit", encoded.bytes, 0, 7]));
    }
});
