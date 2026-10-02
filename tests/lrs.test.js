import test from "node:test";
import assert from "node:assert/strict";
import { decodeLrsPager, encodeLrsPager } from "../js/protocols/lrs.js";

test("LRS pager packet matches legacy packet layout/checksum", () => {
    const out = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    assert.equal(out.hex, "aaaaaafc2d0100010000000000012d");
    assert.equal(out.bytes.length, 15);
    assert.equal(out.checksum, "2d");
});

test("LRS receiver decodes the validated packet", () => {
    const encoded = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    const decoded = decodeLrsPager(encoded.bytes);
    assert.ok(decoded);
    assert.deepEqual(decoded.fields, {
        restaurantId: 1,
        stationId: 0,
        pagerId: 1,
        alertType: 1,
        checksum: 0x2d,
    });
});

test("LRS receiver finds a packet across a rolling raw buffer", () => {
    const encoded = encodeLrsPager({ restaurantId: 42, pagerId: 0xabc, alertType: 3 });
    const raw = new Uint8Array(37);
    raw.fill(0x55);
    raw.set(encoded.bytes, 11);
    const decoded = decodeLrsPager(raw);
    assert.ok(decoded);
    assert.equal(decoded.fields.restaurantId, 42);
    assert.equal(decoded.fields.pagerId, 0xabc);
    assert.equal(decoded.fields.alertType, 3);
});

test("LRS receiver rejects a bad checksum", () => {
    const encoded = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    const bad = encoded.bytes.slice();
    bad[14] ^= 0xff;
    assert.equal(decodeLrsPager(bad), null);
});
