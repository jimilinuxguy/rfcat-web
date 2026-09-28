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

        this.device = await navigator.usb.requestDevice({ filters: SUPPORTED_DEVICES });

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

