import { buildWaveformAnalysis, packWaveform } from "../encoding/waveform.js";
import { encodeManchester } from "../encoding/manchester.js";

export const SCHRADER_MRXBC5A4_PREFIX = "0111111111111111";
export const SCHRADER_MRXBC5A4_HALF_BIT_US = 123;
export const SCHRADER_MRXBC5A4_SYMBOL_RATE = 1_000_000 / SCHRADER_MRXBC5A4_HALF_BIT_US;

function parseHex(value, name, max) {
    const text = String(value).trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]+$/i.test(text)) throw new Error(`${name} must be hexadecimal`);
    const number = Number.parseInt(text, 16);
    if (!Number.isSafeInteger(number) || number < 0 || number > max) throw new Error(`${name} is out of range`);
    return number;
}

export function schraderMrxbc5a4Integrity(id, pressureKPa) {
    const idBits = Number(id).toString(2).padStart(24, "0");
    const pressureBits = Number(pressureKPa).toString(2).padStart(9, "0");
    for (let check = 0; check < 4; check++) {
        const payload = idBits + pressureBits + check.toString(2).padStart(2, "0");
        let evenOnes = 0, n = 0;
        for (let i = 0; i < payload.length; i++) if (payload[i] === "1") { n++; if ((i & 1) === 0) evenOnes++; }
        if (((evenOnes + 2 * n - 1) & 3) === check) return check;
    }
    throw new Error("Unable to construct MRXBC5A4 integrity bits");
}

/** Decoder-effective 61 bits: fixed 16 + flags3 + ID24 + pressure9 + integrity2 + temperature7. */
export function buildSchraderMrxbc5a4LogicalFrame({ flags = 0, id = 0x224015, pressureKPa = 249, temperatureC = 20 } = {}) {
    flags = Number(flags); id = Number(id); pressureKPa = Math.round(Number(pressureKPa)); temperatureC = Math.round(Number(temperatureC));
    if (!Number.isInteger(flags) || flags < 0 || flags > 7) throw new Error("Flags must be a 3-bit integer");
    if (!Number.isInteger(id) || id <= 0 || id >= 0xffffff) throw new Error("ID must be a non-zero 24-bit integer other than 0xFFFFFF");
    if (!Number.isInteger(pressureKPa) || pressureKPa < 0 || pressureKPa > 450) throw new Error("Pressure must be an integer from 0 to 450 kPa");
    if (!Number.isInteger(temperatureC) || temperatureC < -40 || temperatureC > 77) throw new Error("Temperature must be an integer from -40 to 77 °C");
    const temperatureRaw = temperatureC + 50;
    const integrity = schraderMrxbc5a4Integrity(id, pressureKPa);
    const bits = SCHRADER_MRXBC5A4_PREFIX + flags.toString(2).padStart(3,"0") + id.toString(2).padStart(24,"0") + pressureKPa.toString(2).padStart(9,"0") + integrity.toString(2).padStart(2,"0") + temperatureRaw.toString(2).padStart(7,"0");
    return { bits, integrity, temperatureRaw };
}

export function encodeSchraderMrxbc5a4Manchester(logicalBits) {
    logicalBits = String(logicalBits ?? "").replace(/\s/g, "");
    if (!/^[01]{61}$/.test(logicalBits)) throw new Error("MRXBC5A4 logical frame must contain exactly 61 bits");
    return encodeManchester(logicalBits, { zero: "01", one: "10" });
}

const schraderMrxbc5a4 = {
    id: "schrader-mrxbc5a4", name: "Schrader TPMS (MRXBC5A4 / BMW)",
    description: "Schrader MRXBC5A4 / MRXBMW433TX1 TPMS test transmitter. Packet format and integrity are source-derived from rtl_433; RF transmission has not yet been OTA validated. Use only with receivers you own or are authorized to test.",
    fields: [
        { id: "frequency", label: "Frequency (MHz)", type: "number", min: 300, max: 928, step: 0.001, value: 433.92 },
        { id: "id", label: "Sensor ID (hex)", type: "text", value: "224015" },
        { id: "flags", label: "Flags (hex)", type: "text", value: "0" },
        { id: "pressureKPa", label: "Pressure (kPa)", type: "number", min: 0, max: 450, step: 1, value: 249 },
        { id: "temperatureC", label: "Temperature (°C)", type: "number", min: -40, max: 77, step: 1, value: 20 },
    ],
    encode(values) {
        const id = parseHex(values.id, "Sensor ID", 0xffffff); const flags = parseHex(values.flags, "Flags", 7);
        const frame = buildSchraderMrxbc5a4LogicalFrame({ flags, id, pressureKPa: Number(values.pressureKPa), temperatureC: Number(values.temperatureC) });
        const rf = encodeSchraderMrxbc5a4Manchester(frame.bits);
        // reset_limit is 800 us; append eight LOW half-symbols (~984 us) for deterministic termination.
        const tx = packWaveform(rf.waveform + "00000000");
        const analysis = buildWaveformAnalysis({ waveform: rf.waveform, symbolRate: SCHRADER_MRXBC5A4_SYMBOL_RATE, requestedTimings: [{ name: "Manchester half-bit", symbols: 1, requestedUs: 123 }, { name: "Logical bit", symbols: 2, requestedUs: 246 }], label: "Schrader MRXBC5A4 Manchester ASK/OOK" });
        return { bytes: tx.bytes, waveform: rf.waveform, symbols: rf.symbols, padding: rf.padding, bits: frame.bits, id, flags, pressureKPa: Math.round(Number(values.pressureKPa)), temperatureC: Math.round(Number(values.temperatureC)), integrity: frame.integrity, analysis, modulation: "ASK/OOK · software Manchester 0→01, 1→10", summary: `Schrader MRXBC5A4 TX: ID ${id.toString(16).toUpperCase().padStart(6,"0")} · flags ${flags.toString(16).toUpperCase()} · ${Math.round(Number(values.pressureKPa))} kPa · ${Math.round(Number(values.temperatureC))} °C · integrity ${frame.integrity.toString(2).padStart(2,"0")}` };
    },
    async configure(device, values) { const f = Number(values.frequency); if (!Number.isFinite(f) || f <= 0) throw new Error("Frequency must be a positive number"); await device.mode(0x04); await device.setFrequency(f * 1_000_000); await device.setModulation(0x30); await device.setDataRate(SCHRADER_MRXBC5A4_SYMBOL_RATE); await device.setSync(0x0000, 0); await device.setManchester(false); await device.configureAskOokPa(); },
    async transmit(device, encoded) { if (!(encoded?.bytes instanceof Uint8Array) || encoded.bytes.length !== 17) throw new Error("Schrader MRXBC5A4 TX requires exactly 17 bytes including reset tail"); await device.setAmpMode(true); try { await device.transmit(encoded.bytes, 0, 0); } finally { await device.mode(0x04); await device.setAmpMode(false); } },
};

export default schraderMrxbc5a4;
