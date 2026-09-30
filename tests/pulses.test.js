import test from "node:test";
import assert from "node:assert/strict";
import { bytesToPulseRuns, pulseDistribution, estimateBasePulse } from "../js/rx/pulses.js";

test("pulse analyzer converts sampled bits into timed runs", () => {
    const runs = bytesToPulseRuns(new Uint8Array([0b11110011]), 1000);
    assert.deepEqual(runs.map((r) => [r.level, r.symbols]), [[1, 4], [0, 2], [1, 2]]);
    assert.equal(runs[0].durationUs, 4000);
});

test("pulse analyzer clusters similar durations", () => {
    const groups = pulseDistribution([
        { durationUs: 580 }, { durationUs: 588 }, { durationUs: 1680 }, { durationUs: 1676 },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].count, 2);
    assert.equal(Math.round(estimateBasePulse(groups)), 584);
});
