import {
    bytesToBits,
    buildWaveformAnalysis,
    packWaveform,
} from "../encoding/waveform.js";
import { encodeManchester } from "../encoding/manchester.js";

export const SCHRADER_EG53MA4_HALF_BIT_US = 123;
export const SCHRADER_EG53MA4_SYMBOL_RATE =
    1_000_000 / SCHRADER_EG53MA4_HALF_BIT_US;
export const SCHRADER_EG53MA4_PREFIX_BITS = "0".repeat(40);

/** rtl_433 EG53MA4 integrity: sum of the first 9 data bytes modulo 256. */
export function schraderEg53ma4Checksum(data) {
    if (!(data instanceof Uint8Array))
        throw new TypeError("Expected Uint8Array");
    let sum = 0;
    for (const byte of data) sum = (sum + byte) & 0xff;
    return sum;
}

function parseHex(value, name, max) {
    const text = String(value).trim().replace(/^0x/i, "");

    if (!/^[0-9a-f]+$/i.test(text)) {
        throw new Error(`${name} must be hexadecimal`);
    }

    const number = Number.parseInt(text, 16);

    if (!Number.isSafeInteger(number) || number < 0 || number > max) {
        throw new Error(`${name} is out of range`);
    }

    return number;
}

/** Build the 10 bytes rtl_433 extracts after discarding the first 40 decoded bits. */
export function buildSchraderEg53ma4Packet({
    flags = 0x4c900010,
    id = 0x00c169,
    pressureKPa = 237.5,
    temperatureF = 93,
} = {}) {
    flags = Number(flags);
    id = Number(id);
    pressureKPa = Number(pressureKPa);
    temperatureF = Number(temperatureF);

    if (!Number.isInteger(flags) || flags < 0 || flags > 0xffffffff)
        throw new Error("Flags must be a 32-bit unsigned integer");
    if (!Number.isInteger(id) || id < 0 || id > 0xffffff)
        throw new Error("ID must be a 24-bit integer (0..0xFFFFFF)");
    if (!Number.isFinite(pressureKPa) || pressureKPa < 0 || pressureKPa > 637.5)
        throw new Error("Pressure must be between 0 and 637.5 kPa");
    if (
        !Number.isInteger(temperatureF) ||
        temperatureF < 0 ||
        temperatureF > 255
    )
        throw new Error("Temperature must be an integer from 0 to 255 °F");

    const pressureRaw = Math.round(pressureKPa / 2.5);
    const bytes = new Uint8Array(10);
    bytes[0] = (flags >>> 24) & 0xff;
    bytes[1] = (flags >>> 16) & 0xff;
    bytes[2] = (flags >>> 8) & 0xff;
    bytes[3] = flags & 0xff;
    bytes[4] = (id >>> 16) & 0xff;
    bytes[5] = (id >>> 8) & 0xff;
    bytes[6] = id & 0xff;
    bytes[7] = pressureRaw;
    bytes[8] = temperatureF;
    bytes[9] = schraderEg53ma4Checksum(bytes.subarray(0, 9));

    return {
        bytes,
        flags: flags >>> 0,
        id,
        pressureRaw,
        pressureKPa: pressureRaw * 2.5,
        temperatureF,
        checksum: bytes[9],
    };
}

/** rtl_433 requires 120 decoded bits; it discards the first 40 and parses the final 80. */
export function buildSchraderEg53ma4LogicalFrame(
    packetBytes,
    prefixBits = SCHRADER_EG53MA4_PREFIX_BITS,
) {
    if (!(packetBytes instanceof Uint8Array) || packetBytes.length !== 10)
        throw new Error(
            "Schrader EG53MA4 logical frame requires exactly 10 packet bytes",
        );
    prefixBits = String(prefixBits ?? "").replace(/\s/g, "");
    if (!/^[01]{40}$/.test(prefixBits))
        throw new Error("Schrader EG53MA4 prefix must contain exactly 40 bits");
    return prefixBits + bytesToBits(packetBytes);
}

/** OOK_PULSE_MANCHESTER_ZEROBIT candidate matching the validated Schrader polarity. */
export function encodeSchraderEg53ma4Manchester(logicalBits) {
    return encodeManchester(logicalBits, { zero: "01", one: "10" });
}

const schraderEg53ma4 = {
    id: "schrader-eg53ma4",
    name: "Schrader TPMS (EG53MA4)",
    description:
        "Schrader EG53MA4 TPMS test transmitter. The 120-bit framing and Manchester waveform were validated against rtl_433 decoder #95. Use only with sensors/receivers you own or are authorized to test.",
    fields: [
        {
            id: "frequency",
            label: "Frequency (MHz)",
            type: "number",
            min: 300,
            max: 928,
            step: 0.001,
            value: 315.0,
        },
        { id: "flags", label: "Flags (hex)", type: "text", value: "4C900010" },
        { id: "id", label: "Sensor ID (hex)", type: "text", value: "00C169" },
        {
            id: "pressureKPa",
            label: "Pressure (kPa)",
            type: "number",
            min: 0,
            max: 637.5,
            step: 2.5,
            value: 237.5,
        },
        {
            id: "temperatureF",
            label: "Temperature (°F)",
            type: "number",
            min: 0,
            max: 255,
            step: 1,
            value: 93,
        },
    ],
    encode(values) {
        const packet = buildSchraderEg53ma4Packet({
            flags: parseHex(values.flags, "Flags", 0xffffffff),
            id: parseHex(values.id, "Sensor ID", 0xffffff),
            pressureKPa: Number(values.pressureKPa),
            temperatureF: Number(values.temperatureF),
        });
        const bits = buildSchraderEg53ma4LogicalFrame(packet.bytes);
        const rf = encodeSchraderEg53ma4Manchester(bits);
        // Preserve the validated 240-symbol protocol waveform, but append
        // ~984 µs of LOW for clean OTA packet termination.
        const txWaveform = rf.waveform + "00000000";
        const tx = packWaveform(txWaveform);
        const analysis = buildWaveformAnalysis({
            waveform: rf.waveform,
            symbolRate: SCHRADER_EG53MA4_SYMBOL_RATE,
            requestedTimings: [
                {
                    name: "Manchester half-bit",
                    symbols: 1,
                    requestedUs: SCHRADER_EG53MA4_HALF_BIT_US,
                },
                {
                    name: "Logical bit",
                    symbols: 2,
                    requestedUs: SCHRADER_EG53MA4_HALF_BIT_US * 2,
                },
            ],
            label: "Schrader EG53MA4 Manchester ASK/OOK",
        });
        return {
            ...packet,
            bytes: tx.bytes,
            packetBytes: packet.bytes,
            bits,
            waveform: rf.waveform,
            symbols: rf.symbols,
            padding: rf.padding,
            analysis,
            modulation: "ASK/OOK · software Manchester 0→01, 1→10",
            summary: `Schrader EG53MA4 TX: ID ${packet.id.toString(16).toUpperCase().padStart(6, "0")} · ${packet.pressureKPa.toFixed(1)} kPa · ${packet.temperatureF} °F · checksum 0x${packet.checksum.toString(16).toUpperCase().padStart(2, "0")} · ${rf.symbols} RF symbols · ${rf.bytes.length} bytes · ${tx.bytes.length} TX bytes`,
        };
    },
    async configure(device, values) {
        const frequencyMHz = Number(values.frequency);
        if (!Number.isFinite(frequencyMHz) || frequencyMHz <= 0)
            throw new Error("Frequency must be a positive number");

        await device.mode(0x04);
        await device.setFrequency(frequencyMHz * 1_000_000);
        await device.setModulation(0x30); // ASK/OOK
        await device.setDataRate(SCHRADER_EG53MA4_SYMBOL_RATE);
        await device.setSync(0x0000, 0);
        await device.setManchester(false); // already software encoded
        await device.configureAskOokPa();
    },

    async transmit(device, encoded) {
        if (
            !(encoded?.bytes instanceof Uint8Array) ||
            encoded.bytes.length !== 31
        )
            throw new Error(
                "Schrader EG53MA4 TX requires exactly 30 encoded bytes",
            );

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

export default schraderEg53ma4;
