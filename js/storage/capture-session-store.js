import {
    deleteStoredValue,
    getAllStoredValues,
    getStoredValue,
    putStoredValue,
} from "./db.js";

export const CAPTURE_SESSION_STORE = "capture-sessions";
export const CAPTURE_SESSION_SCHEMA_VERSION = 1;

export function normalizeCaptureSession(value) {
    if (!value || typeof value !== "object" || typeof value.id !== "string" || !value.id) return null;
    return {
        ...value,
        schemaVersion: CAPTURE_SESSION_SCHEMA_VERSION,
        name: String(value.name || "Capture session"),
        notes: String(value.notes || ""),
        captures: Array.isArray(value.captures) ? value.captures : [],
    };
}

export async function listCaptureSessions() {
    const sessions = (await getAllStoredValues(CAPTURE_SESSION_STORE))
        .map(normalizeCaptureSession)
        .filter(Boolean);
    return sessions.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
}

export async function getCaptureSession(id) {
    return normalizeCaptureSession(await getStoredValue(CAPTURE_SESSION_STORE, id));
}

export async function saveCaptureSession(session) {
    const normalized = normalizeCaptureSession(session);
    if (!normalized) throw new TypeError("Invalid capture session");
    await putStoredValue(CAPTURE_SESSION_STORE, normalized.id, normalized);
    return normalized;
}

export function deleteCaptureSession(id) {
    return deleteStoredValue(CAPTURE_SESSION_STORE, id);
}
