import test from "node:test";
import assert from "node:assert/strict";

import { exportProtocolToIPython } from "../js/export/ipython.js";
import came12 from "../js/protocols/came12.js";
import tesla from "../js/protocols/tesla.js";

async function encoded(protocol, values) {
    return protocol.encode(values);
}

test("CAME-12 export captures protocol-owned radio configuration and TX", async () => {
    const values = { code: "101001011010", repeats: 3, gapT: 31, repeat: 2, offset: 0 };
    const code = await exportProtocolToIPython(came12, values, await encoded(came12, values));

    assert.match(code, /d\.setFreq\(433920000\)/);
    assert.match(code, /d\.setMdmModulation\(MOD_ASK_OOK\)/);
    assert.match(code, /d\.setMdmDRate\(3125\)/);
    assert.match(code, /d\.RFxmit\(data, repeat=2, offset=0\)/);
});

test("Tesla export uses current user-selected frequency", async () => {
    const values = { frequency: 315000000, repeats: 1 };
    const result = await encoded(tesla, values);
    const code = await exportProtocolToIPython(tesla, values, result);

    assert.match(code, /d\.setFreq\(315000000\)/);
    assert.match(code, /d\.setMdmDRate\(2500\)/);
    assert.match(code, /d\.RFxmit\(data, repeat=0, offset=0\)/);
});
