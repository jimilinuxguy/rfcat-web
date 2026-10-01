import test from "node:test";
import assert from "node:assert/strict";
import {
    POCSAG_SYNC,
    POCSAG_IDLE,
    POCSAG_PREAMBLE_BITS,
    buildPocsagAddressCodeword,
    buildPocsagAlert,
} from "../js/protocols/pocsag.js";

function hasEvenParity(word) {
    let ones = 0;
    for (let bit = 0; bit < 32; bit++) ones += (word >>> bit) & 1;
    return (ones & 1) === 0;
}

test("POCSAG constants match standard framing", () => {
    assert.equal(POCSAG_SYNC, 0x7cd215d8);
    assert.equal(POCSAG_IDLE, 0x7a89c197);
    assert.equal(POCSAG_PREAMBLE_BITS, 576);
});

test("POCSAG address codeword includes BCH and even parity", () => {
    const word = buildPocsagAddressCodeword(79984, 0);
    assert.equal(word, 0x04e1c4e7);
    assert.equal(hasEvenParity(word), true);
});

test("POCSAG capcode selects one of eight frames", () => {
    for (let frame = 0; frame < 8; frame++) {
        const encoded = buildPocsagAlert({ capcode: 80000 + frame });
        assert.equal(encoded.frame, frame);
        assert.equal(encoded.codewords[frame * 2], encoded.addressWord);
        assert.equal(encoded.codewords[frame * 2 + 1], POCSAG_IDLE);
    }
});

test("POCSAG alert is one preamble and one complete batch", () => {
    const encoded = buildPocsagAlert({ capcode: 79992 });
    assert.equal(encoded.bits.length, 576 + 32 + (16 * 32));
    assert.equal(encoded.bytes.length, 140);
    assert.equal(encoded.bits.slice(576, 608), "01111100110100100001010111011000");
});

test("POCSAG inverted polarity complements the complete bitstream", () => {
    const normal = buildPocsagAlert({ capcode: 79992 });
    const inverted = buildPocsagAlert({ capcode: 79992, inverted: true });
    assert.equal(inverted.bits.slice(576, 608), "10000011001011011110101000100111");
    assert.equal(
        inverted.bits,
        normal.bits.replace(/[01]/g, (bit) => bit === "0" ? "1" : "0"),
    );
});

test("POCSAG validates capcode and function", () => {
    assert.throws(() => buildPocsagAddressCodeword(-1, 0), /capcode/);
    assert.throws(() => buildPocsagAddressCodeword(0x200000, 0), /capcode/);
    assert.throws(() => buildPocsagAddressCodeword(1, 4), /function/);
});
