import test from "node:test";
import assert from "node:assert/strict";
import { buildPocsagAlert, decodePocsag } from "../js/protocols/pocsag.js";

test("POCSAG RX decodes an alert-only page", () => {
    const encoded = buildPocsagAlert({ capcode: 123456, functionBits: 2 });
    const decoded = decodePocsag(encoded.bytes);
    assert.equal(decoded.fields.capcode, 123456);
    assert.equal(decoded.fields.function, 2);
    assert.equal(decoded.fields.message, "(alert only)");
    assert.equal(decoded.fields.polarity, "normal");
});

test("POCSAG RX decodes an alphanumeric message", () => {
    const encoded = buildPocsagAlert({ capcode: 79984, functionBits: 3, message: "HELLO" });
    const decoded = decodePocsag(encoded.bytes);
    assert.equal(decoded.fields.capcode, 79984);
    assert.equal(decoded.fields.function, 3);
    assert.equal(decoded.fields.message, "HELLO");
});

test("POCSAG RX detects inverted polarity", () => {
    const encoded = buildPocsagAlert({ capcode: 42, functionBits: 0, message: "TEST", inverted: true });
    const decoded = decodePocsag(encoded.bytes);
    assert.equal(decoded.fields.capcode, 42);
    assert.equal(decoded.fields.message, "TEST");
    assert.equal(decoded.fields.polarity, "inverted");
});

test("POCSAG RX tolerates one bad bit in an address codeword", () => {
    const encoded = buildPocsagAlert({ capcode: 12345, functionBits: 1 });
    const damaged = encoded.bytes.slice();
    // First codeword follows the 72-byte preamble and 4-byte sync.
    const frame = 12345 & 7;
    const byte = 72 + 4 + frame * 8;
    damaged[byte] ^= 0x20;
    const decoded = decodePocsag(damaged);
    assert.equal(decoded.fields.capcode, 12345);
    assert.equal(decoded.fields.correctedBits, 1);
});

test("POCSAG RX rejects unrelated bytes", () => {
    assert.equal(decodePocsag(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8)), null);
});
