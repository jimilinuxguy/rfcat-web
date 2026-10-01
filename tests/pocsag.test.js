import test from "node:test";
import assert from "node:assert/strict";
import {
    POCSAG_SYNC,
    POCSAG_IDLE,
    POCSAG_PREAMBLE_BITS,
    buildPocsagAddressCodeword,
    buildPocsagMessageCodeword,
    buildPocsagAlert,
    buildJtechLegacyAlert,
    JTECH_LEGACY,
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


test("POCSAG alphanumeric message uses 7-bit ASCII and message codewords", () => {
    const encoded = buildPocsagAlert({ capcode: 1, message: "HELLO" });
    assert.equal(encoded.message, "HELLO");
    assert.equal(encoded.messageBits.length, 35);
    assert.equal(encoded.messageWords.length, 2);
    assert.equal(encoded.codewords[0], encoded.addressWord);
    assert.equal(encoded.codewords[1], POCSAG_IDLE);
    assert.equal(encoded.codewords[2], encoded.messageWords[0]);
    assert.equal((encoded.messageWords[0] >>> 31) & 1, 1);
    assert.equal(hasEvenParity(encoded.messageWords[0]), true);
});

test("POCSAG message codeword sets message flag with BCH and parity", () => {
    const word = buildPocsagMessageCodeword(0x12345);
    assert.equal((word >>> 31) & 1, 1);
    assert.equal(hasEvenParity(word), true);
});

test("POCSAG alphanumeric message can continue into a second batch", () => {
    const encoded = buildPocsagAlert({ capcode: 7, message: "ABCDEFGHIJKLMNOPQRST" });
    assert.equal(encoded.batchCount, 2);
    assert.equal(encoded.bits.length, 576 + (2 * (32 + 16 * 32)));
    assert.equal(encoded.bits.slice(576 + 544, 576 + 576), "01111100110100100001010111011000");
});

test("POCSAG alphanumeric validation rejects non-ASCII and oversized messages", () => {
    assert.throws(() => buildPocsagAlert({ capcode: 1, message: "café" }), /7-bit ASCII/);
    assert.throws(() => buildPocsagAlert({ capcode: 7, message: "A".repeat(100) }), /too long/);
});

test("POCSAG validates capcode and function", () => {
    assert.throws(() => buildPocsagAddressCodeword(-1, 0), /capcode/);
    assert.throws(() => buildPocsagAddressCodeword(0x200000, 0), /capcode/);
    assert.throws(() => buildPocsagAddressCodeword(1, 4), /function/);
});

test("JTECH legacy mode reproduces activate_all.py reference framing", () => {
    const out = buildJtechLegacyAlert(79992);
    assert.equal(out.bits.length, 664);
    assert.equal(out.bytes.length, 83);
    assert.equal(out.bits.slice(0, 576), JTECH_LEGACY.preamble);
    assert.equal(out.bits.slice(576, 577), "1");
    assert.equal(out.bits.slice(577, 609), JTECH_LEGACY.sync);
    assert.equal(out.bits.slice(609, 612), "111");
    assert.equal(out.bits.slice(612, 652), JTECH_LEGACY.pagers["79992"]);
    assert.equal(out.bits.slice(652), "001100110011");
});

test("JTECH legacy mode preserves both reference pager bit strings", () => {
    assert.equal(
        buildJtechLegacyAlert(79984).pagerBits,
        "1101100011110001110110001100001010110011",
    );
    assert.equal(
        buildJtechLegacyAlert(79992).pagerBits,
        "1101100011110000111011111010010001010111",
    );
});

test("JTECH legacy mode rejects capcodes not present in reference script", () => {
    assert.throws(() => buildJtechLegacyAlert(1), /79984 and 79992/);
});
