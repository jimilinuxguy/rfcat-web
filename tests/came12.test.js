import test from "node:test";
import assert from "node:assert/strict";
import { encodeCame12 } from "../js/protocols/came12.js";

test("CAME-12 three-burst waveform has expected size", () => {
  const result = encodeCame12("101001011010", { repeats: 3, gapT: 31 });
  assert.equal(result.frameSymbols, 36);
  assert.equal(result.meaningfulSymbols, 170);
  assert.equal(result.padding, 6);
  assert.equal(result.waveform.length, 176);
  assert.equal(result.bytes.length, 22);
});

test("CAME-12 validates code length", () => {
  assert.throws(() => encodeCame12("1010"), /exactly 12 bits/);
});
