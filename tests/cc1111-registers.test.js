import test from "node:test";
import assert from "node:assert/strict";

import { R } from "../js/radio/registers.js";

// These literals are intentionally independent of the application register map.
// Source: upstream RFCat rflib/chipcondefs.py / CC1111 XDATA radio register map.
const EXPECTED_CC1111_REGISTERS = Object.freeze({
    SYNC1: 0xdf00,
    SYNC0: 0xdf01,
    PKTLEN: 0xdf02,
    PKTCTRL1: 0xdf03,
    PKTCTRL0: 0xdf04,
    ADDR: 0xdf05,
    FREQ2: 0xdf09,
    MDMCFG4: 0xdf0c,
    MDMCFG3: 0xdf0d,
    MDMCFG2: 0xdf0e,
    MDMCFG1: 0xdf0f,
    DEVIATN: 0xdf11,
    FREND1: 0xdf1a,
    FREND0: 0xdf1b,
    FSCAL2: 0xdf1d,
    TEST2: 0xdf23,
    TEST1: 0xdf24,
    PA_TABLE1: 0xdf2d,
    PA_TABLE0: 0xdf2e,
    LQI: 0xdf39,
    RSSI: 0xdf3a,
    MARCSTATE: 0xdf3b,
});

test("CC1111 register map matches independently verified addresses", () => {
    for (const [name, address] of Object.entries(EXPECTED_CC1111_REGISTERS)) {
        assert.equal(R[name], address, `${name} must be 0x${address.toString(16)}`);
    }
});

test("PATABLE burst-write alias starts at PA_TABLE1", () => {
    assert.equal(R.PATABLE, 0xdf2d);
    assert.equal(R.PATABLE, R.PA_TABLE1);
});

test("critical modem registers are distinct", () => {
    assert.notEqual(R.DEVIATN, R.FREND0);
    assert.notEqual(R.DEVIATN, R.FSCAL2);
    assert.notEqual(R.RSSI, R.LQI);
});
