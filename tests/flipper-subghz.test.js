import test from "node:test";
import assert from "node:assert/strict";
import {
    parseFlipperRawSub,
    pulseRunsToFlipperTimings,
    serializeFlipperRawSub,
} from "../js/flipper/subghz.js";

test("parse Flipper RAW .sub", () => {
    const parsed = parseFlipperRawSub(`Filetype: Flipper SubGhz RAW File
Version: 1
Frequency: 433920000
Preset: FuriHalSubGhzPresetOok650Async
Protocol: RAW
RAW_Data: 400 -1200 400 -400
RAW_Data: 1200 -400
`);
    assert.equal(parsed.frequency, 433920000);
    assert.deepEqual(parsed.timings, [400, -1200, 400, -400, 1200, -400]);
});

test("serialize Flipper RAW .sub round trips", () => {
    const text = serializeFlipperRawSub({ frequency: 433920000, timings: [300, -900, 900, -300] });
    assert.deepEqual(parseFlipperRawSub(text).timings, [300, -900, 900, -300]);
});

test("RAW timings reject non alternating values", () => {
    assert.throws(() => parseFlipperRawSub(`Filetype: Flipper SubGhz RAW File
Version: 1
Frequency: 433920000
Preset: FuriHalSubGhzPresetOok650Async
Protocol: RAW
RAW_Data: 400 500 -400
`), /alternate sign/);
});

test("pulse runs convert to signed microseconds", () => {
    assert.deepEqual(pulseRunsToFlipperTimings([
        { level: 1, durationUs: 271 },
        { level: 0, durationUs: 813 },
        { level: 1, durationUs: 813 },
        { level: 0, durationUs: 271 },
    ]), [271, -813, 813, -271]);
});
