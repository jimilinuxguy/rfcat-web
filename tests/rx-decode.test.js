import test from "node:test";
import assert from "node:assert/strict";
import came12, { encodeCame12 } from "../js/protocols/came12.js";
import { decodeRxPacket, splitRxStatus } from "../js/rx/decode.js";

test("CAME-12 RX decoder recovers an encoded code", () => {
    const encoded = encodeCame12("101001011010", { repeats: 1 });
    const decoded = decodeRxPacket(encoded.bytes, "auto", {}, [came12]);
    assert.equal(decoded.protocol.id, "came12");
    assert.equal(decoded.fields.code, "101001011010");
    assert.equal(decoded.fields.hex, "0xA5A");
});

test("specific RX decoder returns null for an unrelated payload", () => {
    assert.equal(decodeRxPacket(Uint8Array.of(0, 0, 0, 0, 0), "came12", {}, [came12]), null);
});

test("RX append status is removed and converted to RSSI/LQI", () => {
    const result = splitRxStatus(Uint8Array.of(0xaa, 0xbb, 0xc8, 0x95), true);
    assert.deepEqual([...result.payload], [0xaa, 0xbb]);
    assert.equal(result.rssi, -102);
    assert.equal(result.lqi, 0x15);
    assert.equal(result.crcOk, true);
});
