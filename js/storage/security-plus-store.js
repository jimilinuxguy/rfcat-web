import { openDatabase } from "./db.js";

export const SECURITY_PLUS_STORE = "security-plus-profiles";
export function profileKey(name) {
    const key = String(name ?? "").trim();
    if (!key || key.length > 80) throw new Error("Profile name must have 1–80 characters");
    return key;
}
export async function loadSecurityPlusProfile(name) {
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const request = database.transaction(SECURITY_PLUS_STORE, "readonly").objectStore(SECURITY_PLUS_STORE).get(profileKey(name));
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    } finally { database.close(); }
}
export async function saveSecurityPlusProfile(profile) {
    const name = profileKey(profile.name);
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(SECURITY_PLUS_STORE, "readwrite");
            transaction.objectStore(SECURITY_PLUS_STORE).put({ ...profile, name, updatedAt: new Date().toISOString() }, name);
            transaction.oncomplete = () => resolve(name);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { database.close(); }
}
// Reserve a distinct encoded code before RF transmission. A failed or uncertain
// USB transaction must never reuse the same rolling code automatically.
export async function reserveSecurityPlusCode(name, expectedCode, fixed, frequency, repeats, invert) {
    const key = profileKey(name);
    const database = await openDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(SECURITY_PLUS_STORE, "readwrite");
            const store = transaction.objectStore(SECURITY_PLUS_STORE);
            let reserved = null;
            store.get(key).onsuccess = event => {
                const current = event.target.result;
                const nextCode = current?.nextRolling ?? expectedCode;
                if (current && nextCode !== expectedCode) {
                    transaction.abort();
                    return reject(new Error("Profile rolling code changed elsewhere. Reload profile before transmitting."));
                }
                if (!Number.isInteger(nextCode) || nextCode < 0 || nextCode > 0xfffffffd) {
                    transaction.abort();
                    return reject(new Error("Rolling-code counter exhausted"));
                }
                // The encoder masks bit zero. Advance by two to avoid an identical next waveform.
                const nextRolling = (nextCode & ~1) + 2;
                reserved = { name: key, rolling: nextCode, nextRolling };
                store.put({
                    name: key, nextRolling, fixed, frequency, repeats, invert,
                    lastAttemptedRolling: nextCode, updatedAt: new Date().toISOString(),
                }, key);
            };
            transaction.oncomplete = () => resolve(reserved);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error ?? new Error("Rolling-code reservation failed"));
        });
    } finally { database.close(); }
}
