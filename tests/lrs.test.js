import test from "node:test";
import assert from "node:assert/strict";
import { decodeLrsPager, encodeLrsPager } from "../js/protocols/lrs.js";

test("LRS pager packet matches known-good layout/checksum", () => {
    const out = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    assert.equal(out.hex, "aaaaaafc2d0100010000000000012d");
    assert.equal(out.bytes.length, 15);
    assert.equal(out.checksum, "2d");
});

test("LRS RX decodes AA-synchronized live payload", () => {
    const encoded = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    const payload = encoded.bytes.slice(2);
    assert.equal(payload.length, 13);
    assert.deepEqual(Array.from(payload.slice(0, 3)), [0xaa, 0xfc, 0x2d]);

    const decoded = decodeLrsPager(payload);
    assert.ok(decoded);
    assert.deepEqual(decoded.fields, {
        restaurantId: 1,
        stationId: 0,
        pagerId: 1,
        alertType: 1,
        checksum: 0x2d,
    });
});

test("LRS RX decodes complete reference frame", () => {
    const encoded = encodeLrsPager({ restaurantId: 42, pagerId: 0xabc, alertType: 3 });
    const decoded = decodeLrsPager(encoded.bytes);
    assert.ok(decoded);
    assert.deepEqual(decoded.fields, {
        restaurantId: 42,
        stationId: 0,
        pagerId: 0xabc,
        alertType: 3,
        checksum: encoded.bytes[14],
    });
});

test("LRS RX rejects corrupted hardware-sync packets", () => {
    const corrupt = [
        "AB F0 B4 04 00 04 00 00 00 00 00 04 B5",
        "AA AF C2 D0 10 00 10 00 00 00 00 00 12",
        "AA BF 0B 40 40 00 40 00 00 00 00 00 4B",
    ];
    for (const hex of corrupt) {
        const bytes = Uint8Array.from(hex.split(" ").map((value) => parseInt(value, 16)));
        assert.equal(decodeLrsPager(bytes), null);
    }
});

test("LRS RX rejects correct header with bad checksum", () => {
    const encoded = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    const payload = encoded.bytes.slice(2);
    payload[payload.length - 1] ^= 0x01;
    assert.equal(decodeLrsPager(payload), null);
});
