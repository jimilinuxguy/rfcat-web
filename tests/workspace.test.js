import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkspaceLayout } from "../js/ui/workspace.js";

test("workspace layout rejects unknown versions", () => {
    assert.equal(normalizeWorkspaceLayout({ version: 99, panels: [] }), null);
});

test("workspace layout keeps known panels and sanitizes dimensions", () => {
    const layout = normalizeWorkspaceLayout({
        version: 1,
        panels: [
            { id: "receiver", order: 2, width: 100, height: 20, open: true },
            { id: "unknown", order: 1, width: 900, height: 500, open: false },
        ],
    });
    assert.deepEqual(layout, {
        version: 1,
        panels: [
            { id: "receiver", order: 2, width: 280, height: 58, open: true },
        ],
    });
});
