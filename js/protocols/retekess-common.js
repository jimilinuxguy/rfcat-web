import { buildWaveformAnalysis } from "../encoding/waveform.js";

export function bitsOf(value, width, { lsb = false } = {}) {
    let bits = Number(value).toString(2).padStart(width, "0");
    if (bits.length > width) throw new Error(`Value does not fit in ${width} bits`);
    return lsb ? bits.split("").reverse().join("") : bits;
}

export function packWaveform(waveform) {
    const padding = (8 - waveform.length % 8) % 8;
    const padded = waveform + "0".repeat(padding);
    const bytes = new Uint8Array(padded.length / 8);
    for (let i = 0; i < padded.length; i += 8) bytes[i / 8] = parseInt(padded.slice(i, i + 8), 2);
    return { bytes, padding };
}

export function pulseEncode(bits, { zero = [1, 3], one = [3, 1], prefix = "", suffix = "" } = {}) {
    let waveform = prefix;
    for (const bit of bits) {
        const [hi, lo] = bit === "1" ? one : zero;
        waveform += "1".repeat(hi) + "0".repeat(lo);
    }
    return waveform + suffix;
}

export function makeOokAnalysis(waveform, symbolRate, label, timings = []) {
    return buildWaveformAnalysis({ waveform, symbolRate, label, requestedTimings: timings });
}

export async function configureOok(device, frequency, symbolRate) {
    await device.mode(0x04);
    await device.setFrequency(frequency);
    await device.setModulation(0x30);
    await device.setDataRate(symbolRate);
    await device.setSync(0x0000, 0);
    await device.setManchester(false);
}

export async function transmitOok(device, bytes, values) {
    await device.configureAskOokPa?.();
    await device.setAmpMode(true);
    try {
        const repeat = Math.max(0, Math.trunc(Number(values.repeat ?? 0)));
        const offset = Number(values.offset ?? 0);
        for (let i = 0; i <= repeat; i++) await device.transmit(bytes, 0, offset);
    } finally {
        await device.mode(0x04);
        await device.setAmpMode(false);
    }
}

export const repeatFields = (value = 0) => [
    { id: "repeat", label: "Repeat count", type: "number", min: 0, max: 100, value },
    { id: "offset", label: "RFCat offset", type: "number", min: 0, value: 0 },
];
