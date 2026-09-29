import { buildWaveformAnalysis, packWaveform } from "../encoding/waveform.js";
import { encodeManchester } from "../encoding/manchester.js";

export const SCHRADER_SMD3MA4_PREAMBLE = "111101010101010101010101010101011110"; // 0xF5555555E
export const SCHRADER_SMD3MA4_SYMBOL_US = 120;
export const SCHRADER_SMD3MA4_SYMBOL_RATE = 1_000_000 / SCHRADER_SMD3MA4_SYMBOL_US;

function parseHex(value, name, max) {
    const text = String(value).trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]+$/i.test(text)) throw new Error(`${name} must be hexadecimal`);
    const number = Number.parseInt(text, 16);
    if (!Number.isSafeInteger(number) || number < 0 || number > max) throw new Error(`${name} is out of range`);
    return number;
}

export function schraderSmd3ma4Integrity(prefix36Bits) {
    const bits = String(prefix36Bits);
    if (!/^[01]{36}$/.test(bits)) throw new Error("Integrity input must be exactly 36 bits");
    for (let check = 0; check < 4; check++) {
        const frame = bits + check.toString(2).padStart(2, "0") + "00";
        let sum = 0;
        for (let i = 0; i < 40; i += 2) sum += Number.parseInt(frame.slice(i, i + 2), 2);
        if ((sum & 0x3) === 1) return check;
    }
    throw new Error("Unable to construct Schrader SMD3MA4 integrity bits");
}

/** 38 decoded bits: fixed 1 + 3 flags + 24 ID + 8 pressure + 2 integrity. */
export function buildSchraderSmd3ma4LogicalFrame({ id = 0x98e08e, flags = 0x6, pressureRaw = 0x34 } = {}) {
    id = Number(id); flags = Number(flags); pressureRaw = Number(pressureRaw);
    if (!Number.isInteger(id) || id < 0 || id > 0xffffff) throw new Error("ID must be a 24-bit integer");
    if (!Number.isInteger(flags) || flags < 0 || flags > 7) throw new Error("Flags must be a 3-bit integer");
    if (!Number.isInteger(pressureRaw) || pressureRaw < 0 || pressureRaw > 255) throw new Error("Pressure raw must be 0..255");
    const first36 = "1" + flags.toString(2).padStart(3, "0") + id.toString(2).padStart(24, "0") + pressureRaw.toString(2).padStart(8, "0");
    const integrity = schraderSmd3ma4Integrity(first36);
    return { bits: first36 + integrity.toString(2).padStart(2, "0"), integrity };
}

/** The preamble's final `10` is the Manchester pair for decoded bit 0; after rtl_433 inversion it becomes fixed leading 1. */
export function encodeSchraderSmd3ma4Waveform(logicalBits) {
    logicalBits = String(logicalBits ?? "").replace(/\s/g, "");
    if (!/^[01]{38}$/.test(logicalBits) || logicalBits[0] !== "1") throw new Error("SMD3MA4 logical frame must be 38 bits beginning with 1");
    const rest = encodeManchester(logicalBits.slice(1), { zero: "01", one: "10" });
    const waveform = SCHRADER_SMD3MA4_PREAMBLE + rest.waveform;
    return { ...packWaveform(waveform), logicalBits };
}

function createProtocol({ id, name, pressureScalePsi, defaultFrequency }) {
    return {
        id, name,
        description: `${name} TPMS test transmitter. Wire format is source-derived from rtl_433; RF transmission has not yet been OTA validated. Use only with receivers you own or are authorized to test.`,
        fields: [
            { id: "frequency", label: "Frequency (MHz)", type: "number", min: 300, max: 928, step: 0.001, value: defaultFrequency },
            { id: "id", label: "Sensor ID (hex)", type: "text", value: "98E08E" },
            { id: "flags", label: "Flags (hex)", type: "text", value: "6" },
            { id: "pressurePsi", label: "Pressure (PSI)", type: "number", min: 0, max: 255 * pressureScalePsi, step: pressureScalePsi, value: 10.4 },
        ],
        encode(values) {
            const sensorId = parseHex(values.id, "Sensor ID", 0xffffff);
            const flags = parseHex(values.flags, "Flags", 0x7);
            const requestedPressure = Number(values.pressurePsi);
            if (!Number.isFinite(requestedPressure) || requestedPressure < 0 || requestedPressure > 255 * pressureScalePsi) throw new Error("Pressure is out of range");
            const pressureRaw = Math.round(requestedPressure / pressureScalePsi);
            const logical = buildSchraderSmd3ma4LogicalFrame({ id: sensorId, flags, pressureRaw });
            const rf = encodeSchraderSmd3ma4Waveform(logical.bits);
            const tx = packWaveform(rf.waveform + "0000"); // 480 us LOW reset tail
            const analysis = buildWaveformAnalysis({ waveform: rf.waveform, symbolRate: SCHRADER_SMD3MA4_SYMBOL_RATE, requestedTimings: [{ name: "PCM / Manchester half-symbol", symbols: 1, requestedUs: 120 }], label: `${name} ASK/OOK` });
            return { bytes: tx.bytes, waveform: rf.waveform, symbols: rf.symbols, padding: rf.padding, bits: logical.bits, id: sensorId, flags, pressureRaw, pressurePsi: pressureRaw * pressureScalePsi, integrity: logical.integrity, analysis, modulation: "ASK/OOK · 36-bit preamble + software Manchester", summary: `${name} TX: ID ${sensorId.toString(16).toUpperCase().padStart(6,"0")} · flags ${flags.toString(16).toUpperCase()} · ${ (pressureRaw * pressureScalePsi).toFixed(1) } PSI · integrity ${logical.integrity.toString(2).padStart(2,"0")}` };
        },
        async configure(device, values) {
            const frequencyMHz = Number(values.frequency);
            if (!Number.isFinite(frequencyMHz) || frequencyMHz <= 0) throw new Error("Frequency must be a positive number");
            await device.mode(0x04); await device.setFrequency(frequencyMHz * 1_000_000); await device.setModulation(0x30); await device.setDataRate(SCHRADER_SMD3MA4_SYMBOL_RATE); await device.setSync(0x0000, 0); await device.setManchester(false); await device.configureAskOokPa();
        },
        async transmit(device, encoded) {
            if (!(encoded?.bytes instanceof Uint8Array) || !encoded.bytes.length) throw new Error(`${name} generated no TX data`);
            await device.setAmpMode(true); try { await device.transmit(encoded.bytes, 0, 0); } finally { await device.mode(0x04); await device.setAmpMode(false); }
        },
    };
}

export const schraderSmd3ma4 = createProtocol({ id: "schrader-smd3ma4", name: "Schrader TPMS (SMD3MA4 / Subaru)", pressureScalePsi: 0.2, defaultFrequency: 315.0 });
export const schraderNis315g3 = createProtocol({ id: "schrader-nis315g3", name: "Schrader TPMS (NIS315G3 / Nissan)", pressureScalePsi: 0.25, defaultFrequency: 315.0 });
export default schraderSmd3ma4;
