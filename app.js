// RFCat Web - native RFCat firmware protocol over WebUSB

const C = {
    APP_SYSTEM: 0xff,

    APP_NIC: 0x42,

    SYS_PEEK: 0x80,

    SYS_POKE: 0x81,

    SYS_PING: 0x82,

    SYS_RFMODE: 0x88,

    SYS_PARTNUM: 0x8e,

    NIC_RECV: 0x01,

    NIC_XMIT: 0x02,

    RF_RX: 0x02,

    RF_TX: 0x03,

    RF_IDLE: 0x04,
};

const R = {
    SYNC1: 0xdf00,

    SYNC0: 0xdf01,

    PKTLEN: 0xdf02,

    PKTCTRL1: 0xdf03,

    PKTCTRL0: 0xdf04,

    ADDR: 0xdf05,

    FREQ2: 0xdf09,

    FSCAL2: 0xdf1d,

    MDMCFG4: 0xdf0c,

    MDMCFG3: 0xdf0d,

    MDMCFG2: 0xdf0e,

    FREND1: 0xdf1a,

    TEST2: 0xdf23,

    TEST1: 0xdf24,

    LQI: 0xdf33,

    RSSI: 0xdf34,

    MARCSTATE: 0xdf3b,
};

const SUPPORTED = [
    { vendorId: 0x1d50, productId: 0x6047 },

    { vendorId: 0x1d50, productId: 0x6048 },

    { vendorId: 0x1d50, productId: 0x605b },

    { vendorId: 0x1d50, productId: 0xecc1 },

    { vendorId: 0x0451, productId: 0x4715 },
];

const $ = (id) => document.getElementById(id);

const log = (s) => {
    $("log").textContent += `[${new Date().toLocaleTimeString()}] ${s}\n`;

    $("log").scrollTop = $("log").scrollHeight;
};

const u16 = (n) => new Uint8Array([n & 255, (n >> 8) & 255]);

const concat = (...xs) => {
    let n = xs.reduce((a, x) => a + x.length, 0),
        o = new Uint8Array(n),
        p = 0;

    for (const x of xs) {
        o.set(x, p);

        p += x.length;
    }

    return o;
};

const hex = (b) =>
    [...b].map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");

const text = (b) => new TextDecoder().decode(b).replace(/**\0**/ g, "");

class RFCatUSB extends EventTarget {
    constructor() {
        super();

        this.device = null;

        this.running = false;

        this.buf = new Uint8Array();

        this.waiters = [];
    }

    async connect() {
        if (!navigator.usb)
            throw new Error(
                "WebUSB is unavailable. Use desktop Chrome/Edge over HTTPS or localhost.",
            );

        this.device = await navigator.usb.requestDevice({ filters: SUPPORTED });

        await this.device.open();

        if (!this.device.configuration)
            await this.device.selectConfiguration(1);

        await this.device.claimInterface(0);

        this.running = true;

        this.readLoop();

        await this.ping();
    }

    async disconnect() {
        this.running = false;

        try {
            await this.device?.releaseInterface(0);
        } catch {}

        try {
            await this.device?.close();
        } catch {}

        this.device = null;
    }

    async readLoop() {
        while (this.running && this.device?.opened) {
            try {
                const r = await this.device.transferIn(5, 512);

                if (r.status === "ok" && r.data?.byteLength) {
                    const chunk = new Uint8Array(
                        r.data.buffer,

                        r.data.byteOffset,

                        r.data.byteLength,
                    );

                    this.feed(chunk);
                }
            } catch (e) {
                if (this.running) {
                    log(`USB read: ${e.message}`);

                    await new Promise((r) => setTimeout(r, 100));
                }
            }
        }
    }

    feed(chunk) {
        this.buf = concat(this.buf, chunk);

        for (;;) {
            let at = this.buf.indexOf(0x40);

            if (at < 0) {
                this.buf = new Uint8Array();

                return;
            }

            if (at > 0) this.buf = this.buf.slice(at);

            if (this.buf.length < 5) return;

            const app = this.buf[1],
                cmd = this.buf[2],
                len = this.buf[3] | (this.buf[4] << 8);

            if (this.buf.length < 5 + len) return;

            const payload = this.buf.slice(5, 5 + len);

            this.buf = this.buf.slice(5 + len);

            const i = this.waiters.findIndex(
                (w) => w.app === app && w.cmd === cmd,
            );

            if (i >= 0) {
                const w = this.waiters.splice(i, 1)[0];

                clearTimeout(w.timer);

                w.resolve(payload);
            } else if (app === C.APP_NIC && cmd === C.NIC_RECV) {
                log(
                    `RF RX FRAME: app=0x${app.toString(16).padStart(2, "0")} ` +
                        `cmd=0x${cmd.toString(16).padStart(2, "0")} ` +
                        `len=${payload.length} · ${hex(payload)}`,
                );

                this.dispatchEvent(
                    new CustomEvent("packet", { detail: payload }),
                );
            } else {
                log(
                    `UNSOLICITED FRAME: app=0x${app.toString(16).padStart(2, "0")} ` +
                        `cmd=0x${cmd.toString(16).padStart(2, "0")} ` +
                        `len=${payload.length} · ${hex(payload)}`,
                );

                this.dispatchEvent(
                    new CustomEvent("frame", {
                        detail: { app, cmd, payload },
                    }),
                );
            }
        }
    }

    wait(app, cmd, ms = 3000) {
        return new Promise((resolve, reject) => {
            const w = { app, cmd, resolve };

            w.timer = setTimeout(() => {
                this.waiters = this.waiters.filter((x) => x !== w);

                reject(
                    new Error(
                        `Timeout waiting for ${app.toString(16)}:${cmd.toString(16)}`,
                    ),
                );
            }, ms);

            this.waiters.push(w);
        });
    }

    async send(app, cmd, payload = new Uint8Array(), timeout = 3000) {
        const frame = concat(
            new Uint8Array([app, cmd]),
            u16(payload.length),
            payload,
        );

        const pending = this.wait(app, cmd, timeout);

        for (let p = 0; p < frame.length; p += 64) {
            const chunk = frame.slice(p, p + 64);
            const chunkNumber = Math.floor(p / 64) + 1;
            const chunkCount = Math.ceil(frame.length / 64);

            log(
                `USB OUT app=0x${app.toString(16).padStart(2, "0")} ` +
                    `cmd=0x${cmd.toString(16).padStart(2, "0")} ` +
                    `payload=${payload.length} · ` +
                    `chunk ${chunkNumber}/${chunkCount} · ` +
                    `${chunk.length} bytes: ${hex(chunk)}`,
            );

            const r = await this.device.transferOut(5, chunk);

            if (r.status !== "ok") {
                throw new Error(`USB write ${r.status}`);
            }
        }

        return pending;
    }

    ping() {
        return this.send(
            C.APP_SYSTEM,

            C.SYS_PING,

            new TextEncoder().encode("RFCAT-WEB"),
        );
    }

    peek(addr, count = 1) {
        return this.send(
            C.APP_SYSTEM,

            C.SYS_PEEK,

            concat(u16(count), u16(addr)),
        );
    }

    poke(addr, data) {
        return this.send(C.APP_SYSTEM, C.SYS_POKE, concat(u16(addr), data));
    }

    mode(m) {
        return this.send(C.APP_SYSTEM, C.SYS_RFMODE, new Uint8Array([m]));
    }

    async setFrequency(hz) {
        const num = Math.floor(hz * (0x10000 / 1e6 / 24));

        const f = new Uint8Array([
            (num >> 16) & 255,

            (num >> 8) & 255,

            num & 255,
        ]);

        let cal = 0x2a;

        if (
            (hz > 615e6 && hz < 848e6) ||
            (hz > 369e6 && hz < 424e6) ||
            hz < 318e6
        )
            cal = 0x0a;

        await this.mode(C.RF_IDLE);

        await this.poke(R.FREQ2, f);

        await this.poke(R.FSCAL2, new Uint8Array([cal]));
    }

    async setDataRate(rate) {
        let e, m;

        for (e = 0; e < 16; e++) {
            m = Math.round((rate * 2 ** 28) / (2 ** e * 24e6) - 256);

            if (m < 256) break;
        }

        if (e === 16 || m < 0) throw new Error("Unsupported data rate");

        let m4 = (await this.peek(R.MDMCFG4))[0];

        m4 = (m4 & 0xf0) | (e & 0x0f);

        await this.poke(R.MDMCFG3, new Uint8Array([m]));

        await this.poke(R.MDMCFG4, new Uint8Array([m4]));
    }

    async setBandwidth(bw) {
        const candidates = [];

        for (let e = 0; e < 4; e++) {
            for (let m = 0; m < 4; m++) {
                const actual = 24e6 / (8 * (4 + m) * 2 ** e);

                candidates.push({
                    e,

                    m,

                    actual,

                    error: Math.abs(actual - bw),
                });
            }
        }

        candidates.sort((a, b) => a.error - b.error);

        const best = candidates[0];

        let mdmcfg4 = (await this.peek(R.MDMCFG4))[0];

        // Only change CHANBW_E and CHANBW_M.

        // Preserve the data-rate exponent in the low nibble.

        mdmcfg4 =
            (mdmcfg4 & 0x0f) | ((best.e & 0x03) << 6) | ((best.m & 0x03) << 4);

        await this.poke(R.MDMCFG4, new Uint8Array([mdmcfg4]));

        return best.actual;
    }

    async setModulation(mod) {
        let v = (await this.peek(R.MDMCFG2))[0];

        v = (v & ~0x70) | (mod & 0x70);

        await this.poke(R.MDMCFG2, new Uint8Array([v]));
    }

    async setSync(word, mode) {
        await this.poke(
            R.SYNC1,

            new Uint8Array([(word >> 8) & 255, word & 255]),
        );

        let v = (await this.peek(R.MDMCFG2))[0];

        v = (v & ~7) | (mode & 7);

        await this.poke(R.MDMCFG2, new Uint8Array([v]));
    }

    async setPacketConfig({
        lengthMode,

        packetLength,

        crc,

        whitening,

        appendStatus,

        addressCheck,

        deviceAddress,
    }) {
        const len = Math.max(1, Math.min(255, Number(packetLength)));

        const addr = Math.max(0, Math.min(255, Number(deviceAddress)));

        // PKTCTRL0: WHITE_DATA bit 6, CRC_EN bit 2, LENGTH_CONFIG bits 1:0.

        // Preserve packet-format/reserved bits; only change fields exposed by this UI.

        let p0 = (await this.peek(R.PKTCTRL0))[0];

        p0 =
            (p0 & ~0x47) |
            (whitening ? 0x40 : 0) |
            (crc ? 0x04 : 0) |
            (lengthMode === "variable" ? 0x01 : 0x00);

        // PKTCTRL1: APPEND_STATUS bit 2, ADR_CHK bits 1:0.

        // Preserve PQT and unused bits.

        let p1 = (await this.peek(R.PKTCTRL1))[0];

        p1 =
            (p1 & ~0x07) |
            (appendStatus ? 0x04 : 0) |
            (Number(addressCheck) & 0x03);

        await this.poke(R.PKTLEN, new Uint8Array([len]));

        await this.poke(R.ADDR, new Uint8Array([addr]));

        await this.poke(R.PKTCTRL0, new Uint8Array([p0]));

        await this.poke(R.PKTCTRL1, new Uint8Array([p1]));
    }

    async dumpRadioRegisters() {
        const regs = await this.peek(0xdf00, 0x3e);

        const lines = [];

        for (let i = 0; i < regs.length; i += 16) {
            const chunk = regs.slice(i, i + 16);

            lines.push(
                `0x${(0xdf00 + i).toString(16).toUpperCase()}: ` +
                    [...chunk]

                        .map((x) =>
                            x.toString(16).padStart(2, "0").toUpperCase(),
                        )

                        .join(" "),
            );
        }

        return lines.join("\n");
    }

    async lowball() {
        // Exact register changes observed from RFCat d.lowball()

        // on the working YARD Stick One configuration.

        const writes = [
            [0xdf00, 0xaa],

            [0xdf01, 0xaa],

            [0xdf02, 0xfa],

            [0xdf03, 0x00],

            [0xdf0e, 0x34],

            [0xdf38, 0x00],

            [0xdf3a, 0xc5],
        ];

        for (const [addr, value] of writes) {
            await this.poke(addr, new Uint8Array([value]));
        }
    }

    async config() {
        const b = await this.peek(0xdf00, 0x3e);

        const num = (b[9] << 16) | (b[10] << 8) | b[11],
            freq = num / (0x10000 / 1e6 / 24);

        const de = b[12] & 15,
            dm = b[13],
            rate = (24e6 * (256 + dm) * 2 ** de) / 2 ** 28;

        const be = (b[12] >> 6) & 3,
            bm = (b[12] >> 4) & 3,
            bw = 24e6 / (8 * (4 + bm) * 2 ** be);

        return {
            raw: b,

            freq,

            rate,

            bw,

            mod: b[14] & 0x70,

            sync: (b[0] << 8) | b[1],

            syncMode: b[14] & 7,

            packetLength: b[2],

            pktctrl1: b[3],

            pktctrl0: b[4],

            deviceAddress: b[5],

            lengthMode: (b[4] & 0x03) === 1 ? "variable" : "fixed",

            crc: !!(b[4] & 0x04),

            whitening: !!(b[4] & 0x40),

            appendStatus: !!(b[3] & 0x04),

            addressCheck: b[3] & 0x03,

            marc: b[0x3b] & 0x1f,
        };
    }

    async setTxPaPower() {
        const frend0 = (await this.peek(0xdf1b, 1))[0];

        // Match RFCat: PA_POWER = 1 while preserving the other FREND0 bits.
        const value = (frend0 & 0xf8) | 0x01;

        await this.poke(0xdf1b, new Uint8Array([value]));
    }

    transmit(data, repeat = 0, offset = 0) {
        if (data.length > 255)
            throw new Error("MVP TX payload limit is 255 bytes");

        return this.send(
            C.APP_NIC,

            C.NIC_XMIT,

            concat(u16(data.length), u16(repeat), u16(offset), data),

            10000,
        );
    }
}

const d = new RFCatUSB();

let listening = false,
    pc = 0,
    bc = 0,
    monitorTimer = null;

const marcName = (n) =>
    ({
        1: "IDLE",

        13: "RX",

        14: "RX_END",

        15: "RX_RST",

        17: "TX",

        18: "TX_END",

        19: "RXTX_SWITCH",

        20: "TXRX_SWITCH",

        21: "RX_OVERFLOW",

        22: "FSTXON",

        23: "TX_UNDERFLOW",
    })[n] || `0x${n.toString(16).padStart(2, "0")}`;

const rssiDbm = (raw) => {
    const signed = raw >= 128 ? raw - 256 : raw;

    return signed / 2 - 74;
};

async function updateLiveRadio() {
    if (!d.device?.opened) return;

    try {
        const [rssi, lqi, marc] = await Promise.all([
            d.peek(R.RSSI),

            d.peek(R.LQI),

            d.peek(R.MARCSTATE),
        ]);

        $("rssi").textContent = `${rssiDbm(rssi[0]).toFixed(1)} dBm`;

        $("lqi").textContent = String(lqi[0] & 0x7f);

        $("rxstate").textContent = marcName(marc[0] & 0x1f);
    } catch {}
}

function setMonitor(on) {
    if (monitorTimer) {
        clearInterval(monitorTimer);

        monitorTimer = null;
    }

    if (on) {
        updateLiveRadio();

        monitorTimer = setInterval(updateLiveRadio, 500);
    }
}

function enabled(v) {
    for (const id of ["apply", "readcfg", "idle", "rx", "listen", "transmit"])
        $(id).disabled = !v;
}

enabled(false);

function parseHex(s) {
    const clean = s.replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");

    if (clean.length % 2)
        throw new Error("Hex payload must contain complete bytes");

    return new Uint8Array(
        clean.match(/.{2}/g)?.map((x) => parseInt(x, 16)) || [],
    );
}

function encodeCame12(code, { samplesPerT = 1, repeats = 1, gapT = 47 } = {}) {
    const clean = code.replace(/[\s_]/g, "");

    if (!/^[01]{12}$/.test(clean)) {
        throw new Error("CAME-12 code must contain exactly 12 bits");
    }

    /*
     * CAME pulse encoding:
     *
     * 0: HIGH for T,   LOW for 2T
     * 1: HIGH for 2T,  LOW for T
     *
     * We construct an OOK NRZ waveform which can subsequently
     * be packed into bytes for NIC_XMIT.
     */

    let frame = "";

    const high = (n) => "1".repeat(n * samplesPerT);
    const low = (n) => "0".repeat(n * samplesPerT);

    for (const bit of clean) {
        if (bit === "0") {
            frame += high(1);
            frame += low(2);
        } else {
            frame += high(2);
            frame += low(1);
        }
    }

    let waveform = "";

    for (let i = 0; i < repeats; i++) {
        waveform += frame;

        if (i < repeats - 1) {
            waveform += low(gapT);
        }
    }

    const padding = (8 - (waveform.length % 8)) % 8;
    waveform += "0".repeat(padding);

    const bytes = new Uint8Array(waveform.length / 8);

    for (let i = 0; i < waveform.length; i += 8) {
        bytes[i / 8] = parseInt(waveform.slice(i, i + 8), 2);
    }

    return {
        bytes,
        code: clean,
        waveform,
        frameSymbols: frame.length,
        repeats,
        padding,
    };
}
function parseBinarySymbols(s) {
    // Allow spaces, underscores, and line breaks for readability.
    const clean = s.replace(/[\s_]/g, "");

    if (!clean.length) {
        throw new Error("Enter a binary OOK symbol stream");
    }

    if (/[^01]/.test(clean)) {
        throw new Error("Binary OOK symbols may contain only 0 and 1");
    }

    if (clean.length % 8 !== 0) {
        throw new Error(
            `OOK symbol count must be byte-aligned (multiple of 8). ` +
                `Got ${clean.length} symbols.`,
        );
    }

    const bytes = new Uint8Array(clean.length / 8);

    for (let i = 0; i < clean.length; i += 8) {
        bytes[i / 8] = parseInt(clean.slice(i, i + 8), 2);
    }

    return {
        bytes,
        symbols: clean.length,
        bits: clean,
    };
}

function updatePacketControlState() {
    const variable = $("lengthmode").value === "variable";

    $("pktlenlabel").textContent = variable
        ? "Maximum packet length (bytes)"
        : "Packet length (bytes)";

    $("deviceaddr").disabled = Number($("addrcheck").value) === 0;
}

$("lengthmode").addEventListener("change", updatePacketControlState);

$("addrcheck").addEventListener("change", updatePacketControlState);

updatePacketControlState();

async function refresh() {
    const c = await d.config();

    $("freq").value = (c.freq / 1e6).toFixed(6);

    $("drate").value = Math.round(c.rate);

    $("bw").value = (c.bw / 1e3).toFixed(3);

    $("mod").value = String(c.mod);

    $("sync").value = c.sync.toString(16).padStart(4, "0").toUpperCase();

    $("syncmode").value = String(c.syncMode);

    $("lengthmode").value = c.lengthMode;

    $("pktlen").value = c.packetLength;

    $("crc").checked = c.crc;

    $("whitening").checked = c.whitening;

    $("appendstatus").checked = c.appendStatus;

    $("addrcheck").value = String(c.addressCheck);

    $("deviceaddr").value = c.deviceAddress

        .toString(16)

        .padStart(2, "0")

        .toUpperCase();

    updatePacketControlState();

    $("configSummary").textContent =
        `${(c.freq / 1e6).toFixed(6)} MHz · ${Math.round(c.rate)} baud · ${(c.bw / 1e3).toFixed(1)} kHz BW · ` +
        `${c.lengthMode} packet · ${c.packetLength} byte${c.lengthMode === "variable" ? " max" : "s"} · ` +
        `CRC ${c.crc ? "on" : "off"} · MARCSTATE 0x${c.marc.toString(16).padStart(2, "0")}`;

    log(
        `Radio readback: ${(c.freq / 1e6).toFixed(6)} MHz · ${Math.round(c.rate)} baud · ${(c.bw / 1e3).toFixed(3)} kHz BW · ` +
            `sync ${c.sync.toString(16).padStart(4, "0").toUpperCase()} mode ${c.syncMode} · ` +
            `${c.lengthMode} packet ${c.packetLength}${c.lengthMode === "variable" ? " max" : " bytes"} · ` +
            `CRC ${c.crc ? "on" : "off"} · whitening ${c.whitening ? "on" : "off"} · ` +
            `append status ${c.appendStatus ? "on" : "off"} · addr check ${c.addressCheck} · ` +
            `addr 0x${c.deviceAddress.toString(16).padStart(2, "0").toUpperCase()} · ` +
            `PKTCTRL0 0x${c.pktctrl0.toString(16).padStart(2, "0")} · PKTCTRL1 0x${c.pktctrl1.toString(16).padStart(2, "0")} · ` +
            `MARCSTATE 0x${c.marc.toString(16).padStart(2, "0")}`,
    );

    const dump = await d.dumpRadioRegisters();

    log("RADIO REGISTER DUMP:\n" + dump);

    return c;
}

$("connect").onclick = async () => {
    try {
        if (d.device) {
            setMonitor(false);

            await d.disconnect();

            document.body.classList.remove("connected");

            $("status").textContent = "Disconnected";

            $("connect").textContent = "Connect YS1";

            enabled(false);

            return;
        }

        await d.connect();

        document.body.classList.add("connected");

        $("status").textContent =
            `${d.device.productName || "RFCat"} connected`;

        $("connect").textContent = "Disconnect";

        enabled(true);

        log(
            `Connected VID ${d.device.vendorId.toString(16)} PID ${d.device.productId.toString(16)}`,
        );

        await refresh();
    } catch (e) {
        log(`ERROR: ${e.message}`);

        alert(e.message);
    }
};

$("readcfg").onclick = () => refresh().catch((e) => log(`ERROR: ${e.message}`));

$("idle").onclick = () =>
    d

        .mode(C.RF_IDLE)

        .then(() => log("Radio → IDLE"))

        .catch((e) => log(e.message));

$("rx").onclick = () =>
    d

        .mode(C.RF_RX)

        .then(() => log("Radio → RX"))

        .catch((e) => log(e.message));

$("apply").onclick = async () => {
    try {
        await d.mode(C.RF_IDLE);

        await d.setFrequency(Number($("freq").value) * 1e6);

        await d.setDataRate(Number($("drate").value));

        await d.setBandwidth(Number($("bw").value) * 1e3);

        await d.setModulation(Number($("mod").value));

        await d.setSync(
            parseInt($("sync").value, 16),

            Number($("syncmode").value),
        );

        const deviceAddress = parseInt($("deviceaddr").value, 16);

        if (
            !Number.isInteger(deviceAddress) ||
            deviceAddress < 0 ||
            deviceAddress > 255
        )
            throw new Error("Device address must be one byte of hex (00-FF)");

        await d.setPacketConfig({
            lengthMode: $("lengthmode").value,

            packetLength: Number($("pktlen").value),

            crc: $("crc").checked,

            whitening: $("whitening").checked,

            appendStatus: $("appendstatus").checked,

            addressCheck: Number($("addrcheck").value),

            deviceAddress,
        });

        if ($("lowball")?.checked) {
            await d.lowball();
        }

        await refresh();

        log("Radio configuration applied");
    } catch (e) {
        log(`ERROR: ${e.message}`);
    }
};

$("listen").onclick = async () => {
    try {
        listening = !listening;

        $("listen").textContent = listening
            ? "Stop listening"
            : "Start listening";

        if (listening) {
            // Critical: enter RX and then leave the radio alone.

            await d.mode(C.RF_RX);

            log("Listening for RFCat RX packets");

            log(
                `Configured: ${$("freq").value} MHz · ` +
                    `${$("drate").value} baud · ` +
                    `${$("bw").value} kHz BW · ` +
                    `sync ${$("sync").value} · ` +
                    `mode ${$("syncmode").value} · ` +
                    `${$("lengthmode").value} packet · ` +
                    `${$("pktlen").value}${$("lengthmode").value === "variable" ? " max" : " bytes"} · ` +
                    `lowball ${$("lowball")?.checked ? "on" : "off"}`,
            );

            $("rxstate").textContent = "RX";
        } else {
            await d.mode(C.RF_IDLE);

            log("Listening stopped");

            $("rxstate").textContent = "IDLE";
        }
    } catch (e) {
        listening = false;

        $("listen").textContent = "Start listening";

        log(`ERROR: ${e.message}`);
    }
};

d.addEventListener("packet", (e) => {
    if (!listening) return;

    const b = e.detail;

    pc++;

    bc += b.length;

    $("packets").textContent = pc;

    $("bytes").textContent = bc;

    const empty = $(".empty");

    if (empty) empty.remove();

    const el = document.createElement("div");

    el.className = "packet";

    el.innerHTML =
        `\<div class="meta">` +
        `${new Date().toLocaleTimeString()} · ${b.length} bytes` +
        `\</div>` +
        `\<div class="hex">\</div>`;

    el.querySelector(".hex").textContent = hex(b);

    $("packetList").prepend(el);

    log(`RF RX ${b.length} bytes: ${hex(b)}`);
});

$("transmit").onclick = async () => {
    try {
        const mode = $("txmode").value;

        let b;
        if (mode === "came12") {
            await d.setDataRate(3125);

            const encoded = encodeCame12($("payload").value, {
                repeats: 3,
                gapT: 31,
            });

            b = encoded.bytes;

            log(
                `CAME-12 TX: ${encoded.code} · ` +
                    `${encoded.repeats} bursts · ` +
                    `${encoded.waveform.length} symbols · ` +
                    `${b.length} bytes`,
            );
        } else if (mode === "binary") {
            const parsed = parseBinarySymbols($("payload").value);

            b = parsed.bytes;

            const rate = Number($("drate").value);
            const durationMs = (parsed.symbols / rate) * 1000;

            log(
                `OOK TX: ${parsed.symbols} symbols · ` +
                    `${b.length} bytes · ` +
                    `${hex(b)} · ` +
                    `~${durationMs.toFixed(3)} ms @ ${rate} baud`,
            );
        } else {
            b = parseHex($("payload").value);

            if (!b.length) {
                throw new Error("Enter a hex payload");
            }
        }

        if (b.length > 255) {
            throw new Error("TX payload cannot exceed 255 bytes");
        }
        const pa = await d.peek(0xdf2e, 8);
        log(`PATABLE: ${hex(pa)}`);
        // Required for working ASK/OOK TX on our YS1.
        await d.setTxPaPower();

        await d.transmit(
            b,
            Number($("repeat").value),
            Number($("offset").value),
        );

        log(`TX ${b.length} bytes: ${hex(b)}`);
    } catch (e) {
        log(`ERROR: ${e.message}`);
    }
};

$("clear").onclick = () => {
    $("packetList").innerHTML =
        '\<div class="empty">No packets captured.\</div>';

    pc = bc = 0;

    $("packets").textContent = $("bytes").textContent = "0";
};

$("clearlog").onclick = () => ($("log").textContent = "");

navigator.usb?.addEventListener("disconnect", (e) => {
    if (e.device === d.device) {
        setMonitor(false);

        d.running = false;

        d.device = null;

        document.body.classList.remove("connected");

        $("status").textContent = "Disconnected";

        $("connect").textContent = "Connect YS1";

        enabled(false);

        log("Device disconnected");
    }
});

log(
    navigator.usb
        ? "WebUSB ready. Connect a YARD Stick One."
        : "WebUSB unavailable in this browser.",
);
