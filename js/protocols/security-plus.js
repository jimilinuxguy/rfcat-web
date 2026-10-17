// Security+ 1.0 OOK encoder ported from jimilinuxguy/rfcat-secplus.
// The companion source is GPL-3.0-or-later, derived from argilo/secplus.
// Retain the source attribution and license obligations when distributing.
import { R } from "../radio/registers.js";
import { log } from "../ui/log.js";

export const SECPLUS_MAX_FIXED = 3 ** 20 - 1;
export function parseSecplusInteger(value, label, max) {
    const raw = String(value ?? "").trim();
    if (!/^(?:0[xX][0-9a-fA-F]+|[0-9]+)$/.test(raw)) {
        throw new Error(`${label} must be an unsigned decimal or 0x-prefixed hexadecimal integer`);
    }
    const number = raw.toLowerCase().startsWith("0x") ? Number.parseInt(raw.slice(2), 16) : Number(raw);
    if (!Number.isSafeInteger(number) || number < 0 || number > max) {
        throw new Error(`${label} must be in 0..${max}`);
    }
    return number;
}
function ternary(value) {
    const digits = Array(20).fill(0);
    for (let i = 19; i >= 0; i--) {
        digits[i] = value % 3;
        value = Math.floor(value / 3);
    }
    if (value) throw new Error("Ternary field overflow");
    return digits;
}
function reverse32(value) {
    let output = 0;
    for (let i = 0; i < 32; i++) output = (output << 1) | ((value >>> i) & 1);
    return output >>> 0;
}
export function encodeSecurityPlus(rolling, fixed, repeats = 4) {
    if (!Number.isSafeInteger(rolling) || rolling < 0 || rolling > 0xffffffff) throw new Error("Invalid 32-bit rolling code");
    if (!Number.isSafeInteger(fixed) || fixed < 0 || fixed > SECPLUS_MAX_FIXED) throw new Error("Invalid Security+ fixed code");
    if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error("Repetitions must be 1..20");
    const rollingDigits = ternary(reverse32(rolling & 0xfffffffe));
    const fixedDigits = ternary(fixed);
    const samples = [];
    const symbols = [[0, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1]];
    const message = [];
    for (let frame = 0; frame < 2; frame++) {
        let accumulator = 0;
        const payload = [frame ? 2 : 0];
        for (let i = frame * 10; i < frame * 10 + 10; i++) {
            accumulator += rollingDigits[i];
            payload.push(rollingDigits[i]);
            accumulator += fixedDigits[i];
            payload.push(accumulator % 3);
        }
        for (const symbol of payload) message.push(...symbols[symbol]);
        message.push(...Array(116).fill(0));
    }
    samples.push(...Array(100).fill(0));
    for (let i = 0; i < repeats; i++) samples.push(...message);
    samples.push(...Array(100).fill(0));
    const bytes = new Uint8Array(Math.ceil(samples.length / 8));
    samples.forEach((bit, index) => { if (bit) bytes[index >> 3] |= 0x80 >> (index & 7); });
    return {
        bytes, bits: samples.join(""), waveform: samples.join(""),
        symbols: samples.length, frequency: 315.150, modulation: "ASK/OOK",
        symbolRate: 2000, durationMs: samples.length / 2,
        summary: `Security+ 1.0 · rolling ${rolling} · fixed ${fixed} · ${repeats} repeats · ${bytes.length} bytes`,
    };
}

function encodedLengthForRepeats(repeats) {
    const count = Number(repeats);
    if (!Number.isInteger(count) || count < 1 || count > 4) throw new Error("Repetitions must be 1..4");
    return 25 + 50 * count;
}

const securityPlus = {
    id: "security-plus",
    name: "Security+ 1.0 (rolling code)",
    description: "Legacy Security+ 1.0 OOK transmitter. Authorized test equipment only. The next code is saved locally per profile.",
    fields: [
        { id: "profile", label: "Profile name", type: "text", value: "default", placeholder: "Garage test remote" },
        { id: "rolling", label: "Next rolling code (decimal or 0x hex)", type: "text", value: "0x00000000" },
        { id: "fixed", label: "Fixed code (decimal or 0x hex)", type: "text", value: "0x00000000" },
        { id: "frequency", label: "Frequency (MHz)", type: "number", min: 300, max: 348, step: 0.001, value: 315.150 },
        { id: "repeats", label: "Repetitions (1–4 for browser TX)", type: "number", min: 1, max: 4, value: 4 },
        { id: "invert", label: "Invert OOK bits (diagnostic only)", type: "checkbox", value: false },
    ],
    encode(values) {
        const rolling = parseSecplusInteger(values.rolling, "Rolling code", 0xffffffff);
        const fixed = parseSecplusInteger(values.fixed, "Fixed code", SECPLUS_MAX_FIXED);
        const repeats = Number(values.repeats);
        const frequency = Number(values.frequency);
        if (!Number.isFinite(frequency) || frequency < 300 || frequency > 348) throw new Error("Security+ frequency must be 300–348 MHz");
        const encoded = encodeSecurityPlus(rolling, fixed, repeats);
        if (encoded.bytes.length > 255) throw new Error("Waveform exceeds browser RFCat 255-byte TX limit");
        if (values.invert) {
            encoded.bytes = Uint8Array.from(encoded.bytes, bit => bit ^ 0xff);
            encoded.waveform = encoded.bits = encoded.bits.replace(/[01]/g, b => b === "1" ? "0" : "1");
        }
        encoded.frequency = frequency;
        encoded.rolling = rolling;
        encoded.fixed = fixed;
        encoded.repeats = repeats;
        return encoded;
    },
    async configure(device, values) {
        await device.mode(0x04);
        await device.setFrequency(Number(values.frequency) * 1e6);
        await device.setModulation(0x30);
        await device.setDataRate(2000);
        await device.setSync(0, 0);
        await device.setManchester(false);
        let mdmcfg1 = (await device.peek(R.MDMCFG1))[0];
        await device.poke(R.MDMCFG1, new Uint8Array([mdmcfg1 & ~0x80]));
        let pktctrl0 = (await device.peek(R.PKTCTRL0))[0];
        await device.poke(R.PKTCTRL0, new Uint8Array([pktctrl0 & ~0x47]));
        let pktctrl1 = (await device.peek(R.PKTCTRL1))[0];
        await device.poke(R.PKTCTRL1, new Uint8Array([pktctrl1 & ~0x07]));
        // Match rfcat-secplus setMaxPower(): ASK/OOK uses PA_TABLE1, not PA_TABLE0.
        // A populated PA_TABLE0 with PA_POWER=1 can select the wrong power level.
        await device.setMaxPower();
        // The waveform is sent as one fixed-length packet, not the previous
        // radio configuration's packet length.
        await device.poke(R.PKTLEN, new Uint8Array([encodedLengthForRepeats(values.repeats)]));
        // Disable preamble quality threshold and carrier-sense gating.
        const p1 = (await device.peek(R.PKTCTRL1))[0];
        await device.poke(R.PKTCTRL1, new Uint8Array([p1 & 0x07]));
        const pa = await device.peek(R.PATABLE, 2);
        const frend0 = (await device.peek(R.FREND0))[0];
        const pktlen = (await device.peek(R.PKTLEN))[0];
        const pktctrl0 = (await device.peek(R.PKTCTRL0))[0];
        log(`Security+ pre-TX radio: PATABLE0=0x${pa[0].toString(16).padStart(2, "0")} PATABLE1=0x${pa[1].toString(16).padStart(2, "0")} FREND0=0x${frend0.toString(16).padStart(2, "0")} PKTLEN=${pktlen} PKTCTRL0=0x${pktctrl0.toString(16).padStart(2, "0")}`);
        if (pktlen !== encodedLengthForRepeats(values.repeats) || (frend0 & 0x07) !== 1) {
            throw new Error("Security+ TX radio readback does not match expected packet length / PA power");
        }
    },
    async transmit(device, encoded) {
        await device.setAmpMode(true);
        try {
            const reply = await device.transmit(encoded.bytes);
            if (reply?.[0] !== 1) throw new Error("Security+ firmware did not acknowledge TX");
            return { summary: "Security+ firmware acknowledged the TX command. Receiver acceptance not verified." };
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};
export default securityPlus;
