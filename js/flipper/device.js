// Stock Flipper Zero CLI over Web Serial. TX is limited to Princeton 24-bit.
export function buildPrincetonCommand({ key, frequency, te, repeat = 1, device = 0 }) {
    const clean = String(key).replace(/^0x/i, "").replace(/\s+/g, "");
    if (!/^[0-9a-fA-F]{1,6}$/.test(clean)) throw new Error("Key must contain 1–6 hex digits (24 bits)");
    if (!Number.isInteger(frequency) || !(
        (frequency >= 299999755 && frequency <= 348000000) ||
        (frequency >= 386999938 && frequency <= 464000000) ||
        (frequency >= 778999847 && frequency <= 928000000)
    )) throw new Error("Frequency is outside the Flipper Sub-GHz hardware ranges");
    if (!Number.isInteger(te) || te < 100 || te > 10000) throw new Error("TE must be 100–10000 microseconds");
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100) throw new Error("Repeat must be 1–100");
    if (![0, 1].includes(device)) throw new Error("Device must be internal (0) or external (1)");
    return `subghz tx ${clean.toUpperCase()} ${frequency} ${te} ${repeat} ${device}\r`;
}

export class FlipperSerial extends EventTarget {
    constructor() {
        super();
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.reading = false;
    }
    get connected() { return !!this.port && this.reading; }
    async connect() {
        if (!navigator.serial) throw new Error("Web Serial requires desktop Chrome/Edge and HTTPS or localhost");
        if (this.port) throw new Error("Flipper already connected");
        const port = await navigator.serial.requestPort();
        try {
            await port.open({ baudRate: 115200 });
            this.port = port;
            this.writer = port.writable.getWriter();
            this.reading = true;
            this.readLoop();
        } catch (error) {
            try { await port.close(); } catch {}
            throw error;
        }
    }
    async readLoop() {
        try {
            this.reader = this.port.readable.getReader();
            while (this.reading) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value?.length) this.dispatchEvent(new CustomEvent("output", { detail: new TextDecoder().decode(value) }));
            }
        } catch (error) {
            if (this.reading) this.dispatchEvent(new CustomEvent("error", { detail: error }));
        } finally {
            try { this.reader?.releaseLock(); } catch {}
            this.reader = null;
            this.reading = false;
            this.dispatchEvent(new Event("disconnected"));
        }
    }
    async transmit(options) {
        if (!this.connected || !this.writer) throw new Error("Flipper is not connected");
        const command = buildPrincetonCommand(options);
        await this.writer.write(new TextEncoder().encode(command));
        return command.trim();
    }
    async disconnect() {
        this.reading = false;
        try { await this.reader?.cancel(); } catch {}
        try { this.writer?.releaseLock(); } catch {}
        this.writer = null;
        const port = this.port;
        this.port = null;
        try { await port?.close(); } catch {}
    }
}
