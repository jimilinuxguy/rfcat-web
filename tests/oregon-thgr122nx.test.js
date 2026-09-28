import test from "node:test";
import assert from "node:assert/strict";

import {
    buildThgr122nxNibbles,
    encodeThgr122nx,
} from "../js/protocols/oregon-thgr122nx.js";


test("builds THGR122NX frame structure", () => {
    const result =
        buildThgr122nxNibbles({
            channel: 1,
            rollingId: 0x6b,
            temperature: 19.0,
            humidity: 37,
            batteryLow: false,
            unknownNibble: 0x8,
        });

    assert.deepEqual(
        result.nibbles.slice(0, 5),
        [0xf, 0xf, 0xf, 0xf, 0xa],
    );

    assert.deepEqual(
        result.nibbles.slice(5, 9),
        [0x1, 0xd, 0x2, 0x0],
    );

    assert.equal(result.nibbles[9], 0x1);

    assert.deepEqual(
        result.nibbles.slice(10, 12),
        [0x6, 0xb],
    );

    assert.deepEqual(
        result.nibbles.slice(13, 17),
        [0x0, 0x9, 0x1, 0x0],
    );

    assert.deepEqual(
        result.nibbles.slice(17, 19),
        [0x7, 0x3],
    );

    assert.equal(result.nibbles.length, 24);
});


test("THGR122NX RF encoding has expected size", () => {
    const result =
        encodeThgr122nx({
            channel: 1,
            rollingId: 0x6b,
            temperature: 19.0,
            humidity: 37,
        });

    assert.equal(
        result.logicalBits.length,
        96,
    );

    assert.equal(
        result.symbols,
        192,
    );

    assert.equal(
        result.bytes.length,
        24,
    );

    assert.equal(
        result.padding,
        0,
    );
});


test("THGR122NX preamble produces alternating RF", () => {
    const result =
        encodeThgr122nx();

    /*
     * First logical nibble = F.
     *
     * F LSB-first = 1111.
     * Oregon encoding:
     *
     * 1 -> 01
     *
     * Therefore first eight RF symbols = 01010101.
     */
    assert.equal(
        result.waveform.slice(0, 8),
        "01010101",
    );
});