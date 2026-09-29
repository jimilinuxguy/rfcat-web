import test from "node:test";
import assert from "node:assert/strict";
import { buildTouchTunesLogicalFrame, encodeTouchTunes, TOUCHTUNES_COMMANDS } from "../js/protocols/touchtunes.js";

test("TouchTunes builds sync, LSB-first PIN, command and complement", () => {
    assert.equal(buildTouchTunesLogicalFrame(0x01, 0x78), "01011101100000000111100010000111");
});

test("TouchTunes command table preserves The Fonz values", () => {
    assert.equal(TOUCHTUNES_COMMANDS.On_Off, 0x78);
    assert.equal(TOUCHTUNES_COMMANDS.OK, 0x44);
    assert.equal(TOUCHTUNES_COMMANDS["Lock_Queue(#)"], 0x58);
});

test("TouchTunes waveform has source preamble and tail", () => {
    const result = encodeTouchTunes(0, 0x78);
    assert.ok(result.waveform.startsWith("111111111111111100000000"));
    assert.ok(result.waveform.endsWith("1000"));
    assert.equal(result.logicalBits.length, 32);
    assert.equal(result.bytes.length, Math.ceil(result.symbols / 8));
});

test("TouchTunes validates PIN", () => {
    assert.throws(() => encodeTouchTunes(256, 0x44), /PIN/);
});
