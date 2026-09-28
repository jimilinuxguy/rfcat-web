import test from "node:test";
import assert from "node:assert/strict";
import { parseBinarySymbols } from "../js/protocols/binary.js";

test("binary symbols pack MSB-first", () => {
  const result = parseBinarySymbols("11110000 11001100 10101010 01010101 00001111");
  assert.deepEqual([...result.bytes], [0xf0, 0xcc, 0xaa, 0x55, 0x0f]);
});
