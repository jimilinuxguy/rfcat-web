import { C, SUPPORTED_DEVICES } from "./constants.js";
import { R } from "../radio/registers.js";
import { concat, hex, text, u16 } from "../core/bytes.js";
import { log } from "../ui/log.js";

export class RFCatUSB extends EventTarget {
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

        this.device = await navigator.usb.requestDevice({
            filters: SUPPORTED_DEVICES,
        });

        await this.device.open();

        // A previous RFCat session can leave stale endpoint data queued in the
        // CC1111. Reset the USB device before claiming the interface so a
        // reconnect starts from a clean transport state.
        await this.device.reset();

        if (!this.device.configuration)
            await this.device.selectConfiguration(1);

        await this.device.claimInterface(0);

        this.buf = new Uint8Array();
        this.waiters = [];
        this.running = true;

        this.readLoop();

        await this.ping();
    }

    async disconnect() {
        this.running = false;

        const device = this.device;
        this.device = null;

        for (const waiter of this.waiters.splice(0)) {
            clearTimeout(waiter.timer);
            waiter.reject(new Error("USB device disconnected"));
        }

        try {
            await device?.releaseInterface(0);
        } catch {}

        try {
            await device?.close();
        } catch {}
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
            const w = { app, cmd, resolve, reject };

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

        const device = this.device;
        if (!device?.opened) {
            throw new Error("USB device is not connected");
        }

        const pending = this.wait(app, cmd, timeout);
        const cancelPending = (error) => {
            const waiter = this.waiters.find(
                (w) => w.app === app && w.cmd === cmd,
            );
            if (!waiter) return;
            this.waiters = this.waiters.filter((w) => w !== waiter);
            clearTimeout(waiter.timer);
            waiter.reject(error);
        };

        try {
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

                if (this.device !== device || !device.opened) {
                    throw new Error("USB device disconnected during write");
                }

                const r = await device.transferOut(5, chunk);

                if (r.status !== "ok") {
                    throw new Error(`USB write ${r.status}`);
                }
            }

            return await pending;
        } catch (error) {
            cancelPending(error);
            // Observe the rejected waiter even when transferOut failed before
            // the command response could arrive.
            pending.catch(() => {});
            throw error;
        }
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

    async setDeviation(deviationHz) {
        const fxosc = 24_000_000;

        let best = null;

        // CC1111 DEVIATN:
        // deviation = (8 + M) * 2^E * fXOSC / 2^17
        for (let e = 0; e <= 7; e++) {
            for (let m = 0; m <= 7; m++) {
                const actual =
                    ((8 + m) * Math.pow(2, e) * fxosc) / Math.pow(2, 17);

                const error = Math.abs(actual - deviationHz);

                if (!best || error < best.error) {
                    best = {
                        e,
                        m,
                        actual,
                        error,
                    };
                }
            }
        }

        const value = ((best.e & 0x07) << 4) | (best.m & 0x07);

        await this.poke(
            R.DEVIATN, // DEVIATN
            new Uint8Array([value]),
        );

        return best.actual;
    }

    async setManchester(enabled) {
        let v = (await this.peek(R.MDMCFG2))[0];
        v = (v & ~0x08) | (enabled ? 0x08 : 0x00);
        await this.poke(R.MDMCFG2, new Uint8Array([v]));
    }

    async setMaxPower() {
        const c = await this.config();
        const freq = c.freq;
        const modulation = c.mod;

        const power =
            freq <= 400e6
                ? 0xc2
                : freq <= 464e6
                  ? 0xc0
                  : freq <= 900e6
                    ? 0xc2
                    : 0xc0;

        if (modulation === 0x30) {
            // RFCat ASK/OOK uses PA_TABLE1 and PA_POWER=1.
            await this.poke(R.PA_TABLE0, new Uint8Array([0x00]));
            await this.poke(R.PA_TABLE1, new Uint8Array([power]));
            await this.setTxPaPower();
        } else {
            // RFCat FSK/MSK uses PA_TABLE0 and PA_POWER=0.
            await this.poke(R.PA_TABLE0, new Uint8Array([power]));
            await this.poke(R.PA_TABLE1, new Uint8Array([0x00]));

            let frend0 = (await this.peek(R.FREND0, 1))[0];
            frend0 &= 0xf8;
            await this.poke(R.FREND0, new Uint8Array([frend0]));
        }

        return power;
    }
    async startContinuousCarrier() {
        /*
         * Put the radio into IDLE before changing packet
         * engine configuration.
         */
        await this.mode(C.RF_IDLE);

        /*
         * PKTCTRL0.PKT_FORMAT = 2
         *
         * CC1111 random TX mode continuously supplies data
         * to the modulator without using normal FIFO packet
         * transmission.
         */
        let pktctrl0 = (await this.peek(R.PKTCTRL0, 1))[0];

        pktctrl0 = (pktctrl0 & ~0x30) | 0x20;

        await this.poke(R.PKTCTRL0, new Uint8Array([pktctrl0]));

        /*
         * Enter continuous TX.
         */
        await this.mode(C.RF_TX);
    }

    async stopContinuousCarrier() {
        /*
         * Leave TX immediately.
         */
        await this.mode(C.RF_IDLE);

        /*
         * Disable the YARD Stick One RF amplifier.
         */
        await this.setAmpMode(false);
    }
    async setAmpMode(enabled) {
        return this.send(
            C.APP_NIC,
            C.NIC_SET_AMP_MODE,
            new Uint8Array([enabled ? 1 : 0]),
        );
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

    async configureAskOokPa() {
        const pa = new Uint8Array([
            0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ]);

        await this.poke(R.PATABLE, pa);

        let frend0 = (await this.peek(R.FREND0, 1))[0];

        frend0 = (frend0 & 0xf8) | 0x01;

        await this.poke(R.FREND0, new Uint8Array([frend0]));
    }

    async logTxDiagnostics(label = "TX") {
        const c = await this.config();
        const r = c.raw;
        const deviatn = r[0x11];
        const devE = (deviatn >> 4) & 0x07;
        const devM = deviatn & 0x07;
        const deviation =
            ((8 + devM) * (2 ** devE) * 24_000_000) / (2 ** 17);
        const manchester = !!(r[0x0e] & 0x08);

        log(
            `${label} RADIO: ` +
            `${(c.freq / 1e6).toFixed(6)} MHz · ` +
            `${c.rate.toFixed(1)} baud · ` +
            `${(deviation / 1000).toFixed(3)} kHz deviation · ` +
            `mod 0x${c.mod.toString(16).padStart(2, "0")} · ` +
            `Manchester ${manchester ? "on" : "off"} · ` +
            `sync ${c.sync.toString(16).padStart(4, "0").toUpperCase()} mode ${c.syncMode} · ` +
            `${c.lengthMode} packet ${c.packetLength} bytes · ` +
            `PKTCTRL0 0x${c.pktctrl0.toString(16).padStart(2, "0")} · ` +
            `PKTCTRL1 0x${c.pktctrl1.toString(16).padStart(2, "0")} · ` +
            `MARCSTATE 0x${c.marc.toString(16).padStart(2, "0")}`,
        );

        log(
            `${label} REGS: MDMCFG4=0x${r[0x0c].toString(16).padStart(2, "0")} ` +
            `MDMCFG3=0x${r[0x0d].toString(16).padStart(2, "0")} ` +
            `MDMCFG2=0x${r[0x0e].toString(16).padStart(2, "0")} ` +
            `DEVIATN=0x${r[0x11].toString(16).padStart(2, "0")} ` +
            `FREND0=0x${r[0x1b].toString(16).padStart(2, "0")} ` +
            `PATABLE0=0x${r[0x2e].toString(16).padStart(2, "0")}`,
        );

        return c;
    }

    transmit(data, repeat = 0, offset = 0) {
        if (!(data instanceof Uint8Array)) {
            throw new TypeError("RFCat TX data must be a Uint8Array");
        }

        if (data.length === 0) {
            throw new Error("RFCat TX payload cannot be empty");
        }

        if (data.length > 255) {
            throw new RangeError(
                `RFCat TX payload cannot exceed 255 bytes ` +
                    `(received ${data.length})`,
            );
        }

        return this.send(
            C.APP_NIC,

            C.NIC_XMIT,

            concat(u16(data.length), u16(repeat), u16(offset), data),

            10000,
        );
    }
}
