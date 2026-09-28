import test from "node:test";
import assert from "node:assert/strict";
import { encodeLrsPager } from "../js/protocols/lrs.js";

test("LRS pager packet matches legacy packet layout/checksum", () => {
    const out = encodeLrsPager({ restaurantId: 1, pagerId: 1, alertType: 1 });
    assert.equal(out.hex, "aaaaaafc2d0100010000000000012d");
    assert.equal(out.bytes.length, 15);
    assert.equal(out.checksum, "2d");
});
