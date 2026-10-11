// Enhanced Sub-GHz Chat plaintext application framing.
// Source: twisted-pear/esubghz_chat, esubghz_chat.c tx_msg_input/post_rx.
// This is NOT the RF framing used by Flipper's subghz_tx_rx_worker.
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function encodePlaintextChat(message) {
    if (typeof message !== "string" || !message.length) throw new Error("Chat message is required");
    if (message.includes("\r") || message.includes("\n")) throw new Error("Chat message must be one line");
    const body = encoder.encode(message);
    if (body.length > 253) throw new RangeError("Chat message exceeds 253 UTF-8 bytes");
    const bytes = new Uint8Array(body.length + 2);
    bytes.set(body);
    bytes.set([13, 10], body.length);
    return bytes;
}

export function decodePlaintextChat(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("Expected Uint8Array");
    if (!bytes.length) return "";
    const end = bytes[bytes.length - 1] === 10 ? bytes.length - 1 : bytes.length;
    const bodyEnd = end && bytes[end - 1] === 13 ? end - 1 : end;
    return decoder.decode(bytes.subarray(0, bodyEnd));
}
