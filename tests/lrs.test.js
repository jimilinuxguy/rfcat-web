import test from "node:test";
import assert from "node:assert/strict";
import { decodeLrsPager, encodeLrsPager } from "../js/protocols/lrs.js";

test("LRS pager packet matches legacy packet layout/checksum", () => {
    const out = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    assert.equal(out.hex, "aaaaaafc2d0100010000000000012d");
    assert.equal(out.bytes.length, 15);
    assert.equal(out.checksum, "2d");
});


test("LRS RX decodes oversampled Manchester with clock jitter", () => {
    const encoded = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    const bits = Array.from(encoded.bytes, (byte) => byte.toString(2).padStart(8, "0")).join("");
    const chips = Array.from(bits, (bit) => bit === "0" ? "01" : "10").join("");

    let sampled = "111";
    let run = 0;
    for (let at = 0; at < chips.length;) {
        const level = chips[at];
        let end = at + 1;
        while (end < chips.length && chips[end] === level) end++;
        const chipCount = end - at;
        const jitter = run % 3 === 0 ? -1 : run % 3 === 1 ? 0 : 1;
        sampled += level.repeat(Math.max(1, chipCount * 4 + jitter));
        at = end;
        run++;
    }
    sampled += "00000";
    sampled += "0".repeat((8 - sampled.length % 8) % 8);

    const raw = new Uint8Array(sampled.length / 8);
    for (let at = 0; at < sampled.length; at += 8) {
        raw[at / 8] = parseInt(sampled.slice(at, at + 8), 2);
    }

    const decoded = decodeLrsPager(raw, { sampleScale: 4 });
    assert.ok(decoded);
    assert.equal(decoded.fields.restaurantId, 1);
    assert.equal(decoded.fields.pagerId, 1);
    assert.equal(decoded.fields.alertType, 1);
});


test("LRS RX decodes hardware-sync payload without preamble or sync bytes", () => {
    const encoded = encodeLrsPager({ restaurantId: 42, pagerId: 0xabc, alertType: 3 });
    const payload = encoded.bytes.slice(5);
    assert.equal(payload.length, 10);

    const decoded = decodeLrsPager(payload);
    assert.ok(decoded);
    assert.deepEqual(decoded.fields, {
        restaurantId: 42,
        stationId: 0,
        pagerId: 0xabc,
        alertType: 3,
        checksum: encoded.bytes[14],
    });
});

test("LRS RX rejects noise in hardware-sync payload", () => {
    const noise = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(decodeLrsPager(noise), null);
});


function sampledLrsFrame({ width = 4, inverted = false, prefix = "1011010", suffix = "00101" } = {}) {
    const encoded = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    const bits = Array.from(encoded.bytes, (byte) => byte.toString(2).padStart(8, "0")).join("");
    let chips = Array.from(bits, (bit) => bit === "0" ? "01" : "10").join("");
    if (inverted) chips = Array.from(chips, (bit) => bit === "0" ? "1" : "0").join("");

    let sampled = prefix;
    let runIndex = 0;
    for (let at = 0; at < chips.length;) {
        const level = chips[at];
        let end = at + 1;
        while (end < chips.length && chips[end] === level) end++;
        const chipCount = end - at;
        // Deterministic fractional clock drift plus transition jitter.
        const exact = chipCount * width;
        const jitter = [-0.35, 0.10, 0.30, -0.10][runIndex % 4];
        sampled += level.repeat(Math.max(1, Math.round(exact + jitter)));
        at = end;
        runIndex++;
    }
    sampled += suffix;
    sampled += "0".repeat((8 - sampled.length % 8) % 8);

    const raw = new Uint8Array(sampled.length / 8);
    for (let at = 0; at < sampled.length; at += 8) {
        raw[at / 8] = parseInt(sampled.slice(at, at + 8), 2);
    }
    return raw;
}

for (const width of [3.55, 3.75, 3.95, 4.0, 4.15, 4.35, 4.45]) {
    for (const inverted of [false, true]) {
        test(`LRS adaptive RX recovers width ${width} inverted=${inverted}`, () => {
            const decoded = decodeLrsPager(sampledLrsFrame({ width, inverted }));
            assert.ok(decoded);
            assert.equal(decoded.fields.restaurantId, 1);
            assert.equal(decoded.fields.stationId, 0);
            assert.equal(decoded.fields.pagerId, 1);
            assert.equal(decoded.fields.alertType, 1);
            assert.equal(decoded.fields.checksum, 0x2d);
        });
    }
}

test("LRS adaptive RX rejects long structured idle pattern", () => {
    const idle = new Uint8Array(255);
    for (let i = 0; i < idle.length; i++) idle[i] = [0x00, 0xff, 0x7f, 0x80][i % 4];
    assert.equal(decodeLrsPager(idle), null);
});


function rawManchesterSymbols({ inverted = false, bitPrefix = "" } = {}) {
    const encoded = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    const logical = Array.from(encoded.bytes, (byte) => byte.toString(2).padStart(8, "0")).join("");
    let chips = Array.from(logical, (bit) => bit === "0" ? "01" : "10").join("");
    if (inverted) chips = Array.from(chips, (bit) => bit === "0" ? "1" : "0").join("");
    let sampled = bitPrefix + chips;
    sampled += "0".repeat((8 - sampled.length % 8) % 8);
    const raw = new Uint8Array(sampled.length / 8);
    for (let at = 0; at < sampled.length; at += 8) raw[at / 8] = parseInt(sampled.slice(at, at + 8), 2);
    return raw;
}

for (let prefixBits = 0; prefixBits < 8; prefixBits++) {
    for (const inverted of [false, true]) {
        test(`LRS RX decodes 1250-baud raw Manchester symbols offset=${prefixBits} inverted=${inverted}`, () => {
            const raw = rawManchesterSymbols({ inverted, bitPrefix: "1".repeat(prefixBits) });
            const decoded = decodeLrsPager(raw, { sampleScale: 1 });
            assert.ok(decoded);
            assert.deepEqual(decoded.fields, {
                restaurantId: 1,
                stationId: 0,
                pagerId: 1,
                alertType: 1,
                checksum: 0x2d,
            });
        });
    }
}
