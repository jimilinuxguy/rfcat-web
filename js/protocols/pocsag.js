import { buildWaveformAnalysis } from "../encoding/waveform.js";

export const POCSAG_SYNC = 0x7cd215d8;
export const POCSAG_IDLE = 0x7a89c197;
export const POCSAG_PREAMBLE_BITS = 576;
export const POCSAG_BCH_POLY = 0x769;

function wordToBits(word) {
    return (word >>> 0).toString(2).padStart(32, "0");
}

function invertBits(bits) {
    return bits.replace(/[01]/g, (bit) => bit === "0" ? "1" : "0");
}

function bitsToBytes(bits) {
    if (bits.length % 8 !== 0) {
        throw new Error("POCSAG bitstream must contain complete bytes");
    }

    const bytes = new Uint8Array(bits.length / 8);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }
    return bytes;
}

export function pocsagBch(data) {
    data = Number(data);
    if (!Number.isInteger(data) || data < 0 || data > 0x1fffff) {
        throw new Error("POCSAG BCH input must be a 21-bit integer");
    }

    let register = data * 0x400;

    for (let bit = 30; bit >= 10; bit--) {
        if (register & (2 ** bit)) {
            register ^= POCSAG_BCH_POLY * (2 ** (bit - 10));
        }
    }

    return register & 0x3ff;
}

function addEvenParity(wordWithoutParity) {
    let word = (wordWithoutParity * 2) >>> 0;
    let ones = 0;
    for (let bit = 1; bit < 32; bit++) {
        ones += (word >>> bit) & 1;
    }
    if (ones & 1) word |= 1;
    return word >>> 0;
}

export function buildPocsagAddressCodeword(capcode, functionBits = 0) {
    capcode = Number(capcode);
    functionBits = Number(functionBits);

    if (!Number.isInteger(capcode) || capcode < 0 || capcode > 0x1fffff) {
        throw new Error("POCSAG capcode must be 0–2097151");
    }
    if (!Number.isInteger(functionBits) || functionBits < 0 || functionBits > 3) {
        throw new Error("POCSAG function must be 0–3");
    }

    const address = Math.floor(capcode / 8);
    const data = (address * 4) + functionBits;
    const codeword31 = (data * 0x400) + pocsagBch(data);

    return addEvenParity(codeword31);
}

export function buildPocsagAlert({
    capcode,
    functionBits = 0,
    inverted = false,
}) {
    capcode = Number(capcode);
    const addressWord = buildPocsagAddressCodeword(capcode, functionBits);
    const frame = capcode & 7;
    const codewords = Array(16).fill(POCSAG_IDLE >>> 0);
    codewords[frame * 2] = addressWord;

    const preamble = "10".repeat(POCSAG_PREAMBLE_BITS / 2);
    const batch = wordToBits(POCSAG_SYNC) + codewords.map(wordToBits).join("");
    const normalBits = preamble + batch;
    const bits = inverted ? invertBits(normalBits) : normalBits;

    return {
        bytes: bitsToBytes(bits),
        bits,
        normalBits,
        capcode,
        functionBits: Number(functionBits),
        frame,
        addressWord,
        codewords,
        inverted: Boolean(inverted),
    };
}

const pocsag = {
    id: "pocsag",
    name: "POCSAG Pager",
    description:
        "Explicit-capcode POCSAG alert generator with a JTECH reference RF preset.",

    fields: [
        {
            id: "profile",
            label: "Profile",
            type: "select",
            value: "generic",
            options: [
                { value: "generic", label: "Generic POCSAG" },
                { value: "jtech-reference", label: "JTECH reference RF settings" },
            ],
        },
        { id: "frequency", label: "Frequency (Hz)", type: "number", min: 1, value: 457600000 },
        {
            id: "baud",
            label: "Baud",
            type: "select",
            value: "512",
            options: [
                { value: "512", label: "512" },
                { value: "1200", label: "1200" },
                { value: "2400", label: "2400" },
            ],
        },
        { id: "deviation", label: "Deviation (Hz)", type: "number", min: 1, value: 4500 },
        { id: "capcode", label: "Capcode", type: "number", min: 0, max: 2097151, value: 1 },
        {
            id: "functionBits",
            label: "Function",
            type: "select",
            value: "0",
            options: [
                { value: "0", label: "0" },
                { value: "1", label: "1" },
                { value: "2", label: "2" },
                { value: "3", label: "3" },
            ],
        },
        {
            id: "inverted",
            label: "Invert transmitted polarity",
            type: "checkbox",
            value: false,
        },
        { id: "repeat", label: "RFCat repeat", type: "number", min: 0, max: 100, value: 0 },
        { id: "offset", label: "RFCat offset", type: "number", min: 0, value: 0 },
    ],

    encode(values) {
        const encoded = buildPocsagAlert({
            capcode: values.capcode,
            functionBits: values.functionBits,
            inverted: values.inverted,
        });

        const baud = Number(values.baud ?? 512);
        const analysis = buildWaveformAnalysis({
            waveform: encoded.bits,
            symbolRate: baud,
            label: "POCSAG 2-FSK",
            requestedTimings: [
                { name: "Bit", symbols: 1, requestedUs: 1_000_000 / baud },
            ],
        });

        return {
            ...encoded,
            packetBytes: encoded.bytes,
            waveform: encoded.bits,
            analysis,
            modulation: "2-FSK",
            summary:
                `POCSAG TX: capcode ${encoded.capcode} · frame ${encoded.frame} · ` +
                `function ${encoded.functionBits} · ${baud} baud · ` +
                `${encoded.inverted ? "inverted" : "normal"} polarity · ` +
                `${encoded.bytes.length} bytes`,
        };
    },

    async configure(device, values) {
        const profile = String(values.profile ?? "generic");
        const baud = Number(values.baud ?? 512);
        const deviation = Number(values.deviation ?? 4500);

        if (![512, 1200, 2400].includes(baud)) {
            throw new Error("POCSAG baud must be 512, 1200, or 2400");
        }
        if (!Number.isFinite(deviation) || deviation <= 0) {
            throw new Error("POCSAG deviation must be positive");
        }

        // The public JTECH reference script uses 512 baud and 4.5 kHz deviation.
        // Keep these as profile defaults, not claims about every JTECH installation.
        const configuredBaud = profile === "jtech-reference" ? 512 : baud;
        const configuredDeviation = profile === "jtech-reference" ? 4500 : deviation;

        await device.mode(0x04);
        await device.setFrequency(Number(values.frequency));
        await device.setModulation(0x00);
        await device.setDataRate(configuredBaud);
        await device.setDeviation(configuredDeviation);
        await device.setSync(0x0000, 0);
        await device.setManchester(false);
        await device.setMaxPower();
    },

    async transmit(device, encoded, values) {
        await device.setAmpMode(true);
        try {
            await device.transmit(
                encoded.bytes,
                Number(values.repeat ?? 0),
                Number(values.offset ?? 0),
            );
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};

export default pocsag;
