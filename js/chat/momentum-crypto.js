// Momentum Enhanced Sub-GHz Chat encrypted packet compatibility.
// Header: run ID (8 bytes, little-endian opaque), counter (big-endian u32),
// random 12-byte IV, 16-byte GCM tag, ciphertext. Header is authenticated AAD.
export const ENCRYPTED_OVERHEAD = 40;
const utf8 = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export async function momentumKeyFromPassword(password) {
    if (typeof password !== "string" || !password.length) throw new Error("Enter a password");
    return new Uint8Array(await crypto.subtle.digest("SHA-256", utf8.encode(password)));
}
export function momentumKeyFromHex(value) {
    const normalized = value.replace(/\s+/g, "");
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) throw new Error("Raw key must be 64 hexadecimal characters (32 bytes)");
    return Uint8Array.from(normalized.match(/../g), part => parseInt(part, 16));
}
export class MomentumCrypto {
    constructor() {
        this.key = null;
        this.runId = null;
        this.counter = 1;
        this.replay = new Map();
    }
    async setKey(raw) {
        if (!(raw instanceof Uint8Array) || raw.length !== 32) throw new Error("AES-256 key must be 32 bytes");
        this.clear();
        this.key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
        this.runId = crypto.getRandomValues(new Uint8Array(8));
    }
    clear() {
        this.key = null;
        this.runId = null;
        this.counter = 1;
        this.replay = new Map();
    }
    async encrypt(message) {
        if (!this.key) throw new Error("Encryption key not configured");
        const plaintext = utf8.encode(message);
        if (!plaintext.length || plaintext.length + ENCRYPTED_OVERHEAD > 60) throw new Error("Encrypted plaintext must be 1–20 UTF-8 bytes");
        if (this.counter > 0xffffffff) throw new Error("Message counter exhausted; restart encrypted chat");
        const packet = new Uint8Array(ENCRYPTED_OVERHEAD + plaintext.length);
        packet.set(this.runId, 0);
        new DataView(packet.buffer).setUint32(8, this.counter, false);
        crypto.getRandomValues(packet.subarray(12, 24));
        const encrypted = new Uint8Array(await crypto.subtle.encrypt({
            name: "AES-GCM", iv: packet.subarray(12, 24),
            additionalData: packet.subarray(0, 12), tagLength: 128,
        }, this.key, plaintext));
        // WebCrypto returns ciphertext || tag; Flipper expects tag || ciphertext.
        packet.set(encrypted.subarray(encrypted.length - 16), 24);
        packet.set(encrypted.subarray(0, encrypted.length - 16), 40);
        this.counter++;
        return packet;
    }
    async decrypt(packet) {
        if (!this.key) throw new Error("Encryption key not configured");
        if (!(packet instanceof Uint8Array) || packet.length < ENCRYPTED_OVERHEAD + 1) throw new Error("Encrypted packet too short");
        const counter = new DataView(packet.buffer, packet.byteOffset, packet.byteLength).getUint32(8, false);
        const id = Array.from(packet.subarray(0, 8), n => n.toString(16).padStart(2, "0")).join("");
        if (counter <= (this.replay.get(id) ?? 0)) throw new Error("Replay or stale encrypted message");
        const combined = new Uint8Array(packet.length - 40 + 16);
        combined.set(packet.subarray(40), 0);
        combined.set(packet.subarray(24, 40), packet.length - 40);
        const plaintext = await crypto.subtle.decrypt({
            name: "AES-GCM", iv: packet.subarray(12, 24),
            additionalData: packet.subarray(0, 12), tagLength: 128,
        }, this.key, combined);
        const message = decoder.decode(plaintext);
        this.replay.set(id, counter);
        return message;
    }
}
