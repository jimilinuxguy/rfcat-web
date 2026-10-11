import test from "node:test";
import assert from "node:assert/strict";
import { buildPrincetonCommand, FlipperSerial } from "../js/flipper/device.js";

test("formats stock Flipper Princeton TX command", () => {
    assert.equal(buildPrincetonCommand({key:"00ab12",frequency:433920000,te:350,repeat:3,device:0}),
        "subghz tx 00AB12 433920000 350 3 0\r");
});
test("rejects invalid key and radio parameters", () => {
    const base = {key:"ABCDEF",frequency:433920000,te:350,repeat:1,device:0};
    for (const override of [{key:"ABCDEF00"},{key:"GG"},{frequency:500000000},{te:0},{repeat:0},{repeat:101},{device:2}]) {
        assert.throws(() => buildPrincetonCommand({...base,...override}));
    }
});
test("transmit requires connection", async () => {
    await assert.rejects(() => new FlipperSerial().transmit({}), /not connected/);
});
