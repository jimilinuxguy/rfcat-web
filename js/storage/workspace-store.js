import { deleteStoredValue, getStoredValue, putStoredValue } from "./db.js";

export const WORKSPACE_STORE = "workspace";
export const WORKSPACE_LAYOUT_KEY = "default-layout";
export const WORKSPACE_SCHEMA_VERSION = 1;

export const WORKSPACE_PANEL_IDS = Object.freeze([
    "radio",
    "receiver",
    "capture-library",
    "pulse-analyzer",
    "transmitter",
    "waveform",
    "activity",
]);

export function migrateWorkspaceLayout(value) {
    if (!value || !Number.isInteger(value.version) || value.version > WORKSPACE_SCHEMA_VERSION) return null;
    // Version 1 is the initial persisted schema. Future migrations should
    // transform older values one version at a time before normalization.
    return value;
}

export function normalizeWorkspaceLayout(value) {
    const migrated = migrateWorkspaceLayout(value);
    if (!migrated || migrated.version !== WORKSPACE_SCHEMA_VERSION || !Array.isArray(migrated.panels)) return null;
    const known = new Set(WORKSPACE_PANEL_IDS);
    const seen = new Set();
    const panels = migrated.panels
        .filter((panel) => panel && known.has(panel.id) && !seen.has(panel.id) && seen.add(panel.id))
        .map((panel) => ({
            id: panel.id,
            order: Number.isFinite(panel.order) ? Math.max(0, Math.round(panel.order)) : 0,
            width: Number.isFinite(panel.width) ? Math.max(280, Math.round(panel.width)) : null,
            height: Number.isFinite(panel.height) ? Math.max(58, Math.round(panel.height)) : null,
            open: typeof panel.open === "boolean" ? panel.open : null,
        }));
    return { version: WORKSPACE_SCHEMA_VERSION, panels };
}

export async function loadWorkspaceLayout() {
    return normalizeWorkspaceLayout(await getStoredValue(WORKSPACE_STORE, WORKSPACE_LAYOUT_KEY));
}

export async function saveWorkspaceLayout(layout) {
    const normalized = normalizeWorkspaceLayout(layout);
    if (!normalized) throw new TypeError("Invalid workspace layout");
    await putStoredValue(WORKSPACE_STORE, WORKSPACE_LAYOUT_KEY, normalized);
    return normalized;
}

export function resetWorkspaceLayout() {
    return deleteStoredValue(WORKSPACE_STORE, WORKSPACE_LAYOUT_KEY);
}
