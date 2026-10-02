import test from "node:test";
import assert from "node:assert/strict";
import {
    WORKSPACE_SCHEMA_VERSION,
    migrateWorkspaceLayout,
    normalizeWorkspaceLayout,
} from "../js/storage/workspace-store.js";

test("workspace layout rejects unknown future versions", () => {
    assert.equal(normalizeWorkspaceLayout({ version: WORKSPACE_SCHEMA_VERSION + 1, panels: [] }), null);
});

test("workspace migration accepts the current schema", () => {
    const layout = { version: WORKSPACE_SCHEMA_VERSION, panels: [] };
    assert.deepEqual(migrateWorkspaceLayout(layout), layout);
});

test("workspace layout keeps known panels and sanitizes dimensions", () => {
    const layout = normalizeWorkspaceLayout({
        version: WORKSPACE_SCHEMA_VERSION,
        panels: [
            { id: "receiver", order: 2.4, width: 100, height: 20, open: true },
            { id: "unknown", order: 1, width: 900, height: 500, open: false },
        ],
    });
    assert.deepEqual(layout, {
        version: WORKSPACE_SCHEMA_VERSION,
        panels: [
            { id: "receiver", order: 2, width: 280, height: 58, open: true },
        ],
    });
});

test("workspace layout ignores duplicate panel ids", () => {
    const layout = normalizeWorkspaceLayout({
        version: WORKSPACE_SCHEMA_VERSION,
        panels: [
            { id: "radio", order: 0, width: 900, height: 300, open: true },
            { id: "radio", order: 5, width: 400, height: 100, open: false },
        ],
    });
    assert.equal(layout.panels.length, 1);
    assert.equal(layout.panels[0].order, 0);
});
