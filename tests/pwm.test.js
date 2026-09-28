import test from "node:test";
import assert from "node:assert/strict";

import {
    encodeOokPwm,
} from "../js/encoding/pwm.js";

test("encodes basic PWM waveform", () => {
    const result = encodeOokPwm(
        "01",
        {
            zero: [1, 3],
            one: [3, 1],
        },
    );

    assert.equal(
        result.waveform,
        "10001110",
    );

    assert.deepEqual(
        [...result.bytes],
        [0x8e],
    );

    assert.equal(
        result.symbols,
        8,
    );

    assert.equal(
        result.padding,
        0,
    );
});

test("ignores whitespace and underscores", () => {
    const result = encodeOokPwm(
        "0 1_0",
        {
            zero: [1, 3],
            one: [3, 1],
        },
    );

    assert.equal(
        result.bits,
        "010",
    );
});

test("rejects invalid input", () => {
    assert.throws(
        () => encodeOokPwm("0102"),
        /only 0 and 1/,
    );
});