import test from "node:test";
import assert from "node:assert/strict";
import {
    POCSAG_SYNC,
    POCSAG_IDLE,
    POCSAG_PREAMBLE_BITS,
    buildPocsagReferenceBatch,
    inspectPocsagWord,
    invertBits,
} from "../js/protocols/pocsag-reference.js";

test("POCSAG reference constants match standard framing", () => {
    assert.equal(POCSAG_SYNC, 0x7cd215d8);
    assert.equal(POCSAG_IDLE, 0x7a89c197);
    assert.equal(POCSAG_PREAMBLE_BITS, 576);
});

test("POCSAG reference batch exposes preamble, sync, idle and batch size", () => {
    const batch = buildPocsagReferenceBatch();
    assert.equal(batch.preamble.length, 576);
    assert.equal(batch.sync, "01111100110100100001010111011000");
    assert.equal(batch.idle, "01111010100010011100000110010111");
    assert.equal(batch.wordsPerBatch, 16);
});

test("POCSAG inspector recognizes sync word shape and parity", () => {
    const out = inspectPocsagWord(POCSAG_SYNC);
    assert.equal(out.hex, "7cd215d8");
    assert.equal(out.bits.length, 32);
    assert.equal(typeof out.evenParity, "boolean");
});

test("POCSAG bit inversion is reversible", () => {
    const bits = "10000011001011011110101000100111";
    assert.equal(invertBits(invertBits(bits)), bits);
});
