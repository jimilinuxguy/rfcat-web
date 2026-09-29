import test from "node:test";
import assert from "node:assert/strict";
import { packWaveform, quantizeCc1111DataRate, waveformRuns, buildWaveformAnalysis } from "../js/encoding/waveform.js";

test("packWaveform packs MSB-first and reports padding", () => {
    const r = packWaveform("10001110");
    assert.deepEqual([...r.bytes], [0x8e]);
    assert.equal(r.padding, 0);
});

test("CC1111 rate quantizer matches the device algorithm", () => {
    const r = quantizeCc1111DataRate(9800);
    assert.ok(Math.abs(r.actual - 9800) < 20);
    assert.ok(r.symbolPeriodUs > 100 && r.symbolPeriodUs < 103);
});

test("waveformRuns collapses adjacent levels", () => {
    assert.deepEqual(waveformRuns("111001"), [
        { level: 1, start: 0, symbols: 3 },
        { level: 0, start: 3, symbols: 2 },
        { level: 1, start: 5, symbols: 1 },
    ]);
});

test("analysis reports duration and requested timing error", () => {
    const a = buildWaveformAnalysis({ waveform: "110000", symbolRate: 9800,
        requestedTimings: [{ name: "HIGH", symbols: 2, requestedUs: 204 }] });
    assert.equal(a.symbols, 6);
    assert.equal(a.timings[0].symbols, 2);
    assert.ok(a.durationUs > 600);
});
