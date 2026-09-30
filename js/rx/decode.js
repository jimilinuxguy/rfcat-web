export function splitRxStatus(bytes, appendStatus = false) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("RX payload must be a Uint8Array");
    if (!appendStatus || bytes.length < 2) return { payload: bytes, rssi: null, lqi: null, crcOk: null };
    const rawRssi = bytes[bytes.length - 2];
    const status = bytes[bytes.length - 1];
    const signedRssi = rawRssi >= 128 ? rawRssi - 256 : rawRssi;
    return { payload: bytes.slice(0, -2), rssi: signedRssi / 2 - 74, lqi: status & 0x7f, crcOk: !!(status & 0x80) };
}

export function decoderProtocols(items = []) {
    return items.filter((protocol) => typeof protocol.decode === "function");
}

export function decodeRxPacket(bytes, mode = "auto", context = {}, items = []) {
    if (mode === "raw") return null;
    const candidates = mode === "auto" ? decoderProtocols(items) : items.filter((p) => p.id === mode && typeof p.decode === "function");
    for (const protocol of candidates) {
        try {
            const result = protocol.decode(bytes, context);
            if (result) return { protocol, ...result };
        } catch (error) {
            if (mode !== "auto") return { protocol, error: error.message };
        }
    }
    return null;
}
