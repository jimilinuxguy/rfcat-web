import test from "node:test";
import assert from "node:assert/strict";
import { encodeSecurityPlus, parseSecplusInteger, SECPLUS_MAX_FIXED } from "../js/protocols/security-plus.js";
import { createHash } from "node:crypto";

test("Security+ reference waveform matches rfcat-secplus Python SHA-256", () => {
    const result = encodeSecurityPlus(2731817118, 876029924, 4);
    assert.equal(result.symbols, 1800);
    assert.equal(result.bytes.length, 225);
    assert.equal(createHash("sha256").update(result.bytes).digest("hex"), "0dec6c120b998f09cde13c634479db394b8b337f04d0556fb948b8dba1ec3d26");
});
test("Security+ numeric validation and packing", () => {
    assert.equal(parseSecplusInteger("0xFFFFFFFF", "rolling", 0xffffffff), 0xffffffff);
    assert.equal(parseSecplusInteger("123", "fixed", SECPLUS_MAX_FIXED), 123);
    assert.throws(() => parseSecplusInteger("-1", "rolling", 0xffffffff));
    assert.throws(() => encodeSecurityPlus(0, 0, 20), /|/);
    assert.equal(encodeSecurityPlus(0, 0, 1).bytes.length, 75);
    assert.notDeepEqual(encodeSecurityPlus(0, 0, 1).bytes, encodeSecurityPlus(2, 0, 1).bytes);
});
