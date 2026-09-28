import test from "node:test";
import assert from "node:assert/strict";

import {
    encodeManchester,
} from "../js/encoding/manchester.js";

test("normal Manchester encodes 0 as 01", () => {
    const result =
        encodeManchester("0");

    assert.equal(
        result.waveform,
        "01",
    );
});

test("normal Manchester encodes 1 as 10", () => {
    const result =
        encodeManchester("1");

    assert.equal(
        result.waveform,
        "10",
    );
});

test("encodes 0101", () => {
    const result =
        encodeManchester("0101");

    assert.equal(
        result.waveform,
        "01100110",
    );

    assert.deepEqual(
        [...result.bytes],
        [0x66],
    );

    assert.equal(
        result.symbols,
        8,
    );
});

test("encodes 1010", () => {
    const result =
        encodeManchester("1010");

    assert.equal(
        result.waveform,
        "10011001",
    );

    assert.deepEqual(
        [...result.bytes],
        [0x99],
    );
});

test("ignores whitespace and underscores", () => {
    const result =
        encodeManchester("0 1_0 1");

    assert.equal(
        result.bits,
        "0101",
    );
});

test("rejects invalid input", () => {
    assert.throws(
        () => encodeManchester("0102"),
        /only 0 and 1/,
    );
});