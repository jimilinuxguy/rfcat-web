import test from "node:test";
import assert from "node:assert/strict";
import {
    CAPTURE_SESSION_SCHEMA_VERSION,
    normalizeCaptureSession,
} from "../js/storage/capture-session-store.js";

test("capture session normalization rejects missing ids", () => {
    assert.equal(normalizeCaptureSession({ name: "No id" }), null);
});

test("capture session normalization supplies safe defaults", () => {
    assert.deepEqual(normalizeCaptureSession({ id: "abc" }), {
        id: "abc",
        schemaVersion: CAPTURE_SESSION_SCHEMA_VERSION,
        name: "Capture session",
        notes: "",
        captures: [],
    });
});

test("capture session normalization preserves RF metadata and captures", () => {
    const session = normalizeCaptureSession({
        id: "rf-test",
        name: "LRS test",
        notes: "front desk",
        radio: { frequencyMHz: "467.750", dataRate: "1200", modulation: "0" },
        captures: [{ hex: "AA55", rssi: -52.5 }],
    });
    assert.equal(session.radio.frequencyMHz, "467.750");
    assert.equal(session.radio.dataRate, "1200");
    assert.deepEqual(session.captures, [{ hex: "AA55", rssi: -52.5 }]);
});
