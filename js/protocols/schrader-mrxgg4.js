import { bytesToBits, buildWaveformAnalysis } from "../encoding/waveform.js";
import { encodeManchester } from "../encoding/manchester.js";

/** CRC-8 used by rtl_433's Schrader MRXGG4 decoder: poly 0x07, init 0xF0. */
export function schraderCrc8(data, polynomial = 0x07, initial = 0xf0) {
    if (!(data instanceof Uint8Array)) throw new TypeError("Expected Uint8Array");
    let crc = initial & 0xff;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & 0x80)
                ? (((crc << 1) ^ polynomial) & 0xff)
                : ((crc << 1) & 0xff);
        }
    }
    return crc;
}


export const SCHRADER_MRXGG4_SYNC_BITS = "0111";
export const SCHRADER_MRXGG4_HALF_BIT_US = 120;
export const SCHRADER_MRXGG4_SYMBOL_RATE = 1_000_000 / SCHRADER_MRXGG4_HALF_BIT_US;

function parseHex(value, name, max) {
    const text = String(value).trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]+$/i.test(text)) throw new Error(`${name} must be hexadecimal`);
    const number = Number.parseInt(text, 16);
    if (!Number.isSafeInteger(number) || number < 0 || number > max)
        throw new Error(`${name} is out of range`);
    return number;
}

/** Build the 68 decoded bits rtl_433 expects: sync nibble 0x7 + 64 data bits. */
export function buildSchraderMrxgg4LogicalFrame(packetBytes) {
    if (!(packetBytes instanceof Uint8Array) || packetBytes.length !== 8)
        throw new Error("Schrader MRXGG4 logical frame requires exactly 8 packet bytes");
    return SCHRADER_MRXGG4_SYNC_BITS + bytesToBits(packetBytes);
}

/** Validated with rtl_433 decoder #60: logical 0 -> 01, logical 1 -> 10. */
export function encodeSchraderMrxgg4Manchester(logicalBits) {
    return encodeManchester(logicalBits, { zero: "01", one: "10" });
}

export function decodeSchraderMrxgg4Manchester(waveform) {
    waveform = String(waveform ?? "").replace(/\s/g, "");
    if (!waveform.length || waveform.length % 2)
        throw new Error("Manchester waveform must contain a non-zero even number of symbols");
    const zero = "01";
    const one = "10";
    let bits = "";
    for (let i = 0; i < waveform.length; i += 2) {
        const pair = waveform.slice(i, i + 2);
        if (pair === zero) bits += "0";
        else if (pair === one) bits += "1";
        else throw new Error(`Invalid Manchester pair ${pair} at symbol ${i}`);
    }
    return bits;
}

/** Build the 8 data bytes that follow the 4-bit sync nibble. */
export function buildSchraderMrxgg4Packet({
    id = 0x03a38b2,
    flags = 0x67,
    pressureKPa = 0,
    temperatureC = 23,
} = {}) {
    id = Number(id);
    flags = Number(flags);
    pressureKPa = Number(pressureKPa);
    temperatureC = Number(temperatureC);

    if (!Number.isInteger(id) || id < 0 || id > 0x0fffffff)
        throw new Error("ID must be a 28-bit integer (0..0x0FFFFFFF)");
    if (!Number.isInteger(flags) || flags < 0 || flags > 0xff)
        throw new Error("Flags must be an 8-bit integer (0..255)");
    if (!Number.isFinite(pressureKPa) || pressureKPa < 0 || pressureKPa > 637.5)
        throw new Error("Pressure must be between 0 and 637.5 kPa");
    if (!Number.isFinite(temperatureC) || temperatureC < -50 || temperatureC > 205)
        throw new Error("Temperature must be between -50 and 205 °C");

    // rtl_433: pressure = raw * 25 mbar = raw * 2.5 kPa.
    const pressureRaw = Math.round(pressureKPa / 2.5);
    const temperatureRaw = Math.round(temperatureC + 50);

    const bytes = new Uint8Array(8);
    bytes[0] = 0xf0 | ((flags >> 4) & 0x0f);
    bytes[1] = ((flags & 0x0f) << 4) | ((id >> 24) & 0x0f);
    bytes[2] = (id >> 16) & 0xff;
    bytes[3] = (id >> 8) & 0xff;
    bytes[4] = id & 0xff;
    bytes[5] = pressureRaw;
    bytes[6] = temperatureRaw;
    bytes[7] = schraderCrc8(bytes.subarray(0, 7));

    return {
        bytes,
        id,
        flags,
        pressureRaw,
        pressureKPa: pressureRaw * 2.5,
        temperatureRaw,
        temperatureC: temperatureRaw - 50,
        crc: bytes[7],
    };
}

const schraderMrxgg4 = {
    id: "schrader-mrxgg4",
    name: "Schrader TPMS (MRXGG4)",
    description: "Schrader MRXGG4 TPMS test transmitter. Manchester framing/polarity validated against rtl_433 decoder #60. Use only with sensors/receivers you own or are authorized to test.",
    fields: [
        { id: "frequency", label: "Frequency (MHz)", type: "number", min: 300, max: 928, step: 0.001, value: 315.000 },
        { id: "id", label: "Sensor ID (hex)", type: "text", value: "03A38B2" },
        { id: "flags", label: "Flags (hex)", type: "text", value: "67" },
        { id: "pressureKPa", label: "Pressure (kPa)", type: "number", min: 0, max: 637.5, step: 2.5, value: 0 },
        { id: "temperatureC", label: "Temperature (°C)", type: "number", min: -50, max: 205, step: 1, value: 23 },
    ],
    encode(values) {
        const packet = buildSchraderMrxgg4Packet({
            id: parseHex(values.id, "Sensor ID", 0x0fffffff),
            flags: parseHex(values.flags, "Flags", 0xff),
            pressureKPa: Number(values.pressureKPa), temperatureC: Number(values.temperatureC),
        });
        const bits = buildSchraderMrxgg4LogicalFrame(packet.bytes);
        const rf = encodeSchraderMrxgg4Manchester(bits);
        const analysis = buildWaveformAnalysis({
            waveform: rf.waveform,
            symbolRate: SCHRADER_MRXGG4_SYMBOL_RATE,
            requestedTimings: [
                { name: "Manchester half-bit", symbols: 1, requestedUs: SCHRADER_MRXGG4_HALF_BIT_US },
                { name: "Logical bit", symbols: 2, requestedUs: SCHRADER_MRXGG4_HALF_BIT_US * 2 },
            ],
            label: "Schrader MRXGG4 Manchester ASK/OOK",
        });
        return {
            ...packet,
            bytes: rf.bytes,
            packetBytes: packet.bytes,
            bits,
            waveform: rf.waveform,
            symbols: rf.symbols,
            padding: rf.padding,
            analysis,
            modulation: "ASK/OOK · software Manchester 0→01, 1→10",
            summary: `Schrader MRXGG4 TX: ID ${packet.id.toString(16).toUpperCase().padStart(7,"0")} · ${packet.pressureKPa.toFixed(1)} kPa · ${packet.temperatureC} °C · CRC 0x${packet.crc.toString(16).toUpperCase().padStart(2,"0")} · ${rf.symbols} RF symbols · ${rf.bytes.length} bytes`,
        };
    },

    async configure(device, values) {
        const frequencyMHz = Number(values.frequency);
        if (!Number.isFinite(frequencyMHz) || frequencyMHz <= 0)
            throw new Error("Frequency must be a positive number");

        await device.mode(0x04);
        await device.setFrequency(frequencyMHz * 1_000_000);
        await device.setModulation(0x30); // ASK/OOK
        await device.setDataRate(SCHRADER_MRXGG4_SYMBOL_RATE);
        await device.setSync(0x0000, 0);
        await device.setManchester(false); // already software encoded
        await device.configureAskOokPa();
    },

    async transmit(device, encoded) {
        if (!(encoded?.bytes instanceof Uint8Array) || encoded.bytes.length !== 17)
            throw new Error("Schrader MRXGG4 TX requires exactly 17 encoded bytes");

        await device.setAmpMode(true);
        try {
            // One frame only for initial OTA validation.
            await device.transmit(encoded.bytes, 0, 0);
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};

export default schraderMrxgg4;
