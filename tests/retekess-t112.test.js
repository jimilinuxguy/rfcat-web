import test from "node:test";
import assert from "node:assert/strict";
import { encodeRetekessT112Pager69 } from "../js/protocols/retekess-t112.js";

test("Retekess T112 Pager 69 matches published RFCat reference bytes", () => {
    const out = encodeRetekessT112Pager69();
    assert.equal(out.pagerId, 69);
    assert.equal(out.bytes.length, 15);
    assert.equal(out.hex, "00aa888e8e8eee8e8e888e88888888");
});
