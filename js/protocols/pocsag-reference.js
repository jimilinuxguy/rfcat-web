export const POCSAG_SYNC = 0x7cd215d8;
export const POCSAG_IDLE = 0x7a89c197;
export const POCSAG_PREAMBLE_BITS = 576;

export function wordToBits(word) {
    return (word >>> 0).toString(2).padStart(32, "0");
}

export function invertBits(bits) {
    let output = "";
    for (const bit of bits) {
        if (bit !== "0" && bit !== "1") {
            throw new Error("Bit strings may contain only 0 and 1");
        }
        output += bit === "0" ? "1" : "0";
    }
    return output;
}

export function buildPocsagReferenceBatch() {
    return {
        preamble: "10".repeat(POCSAG_PREAMBLE_BITS / 2),
        sync: wordToBits(POCSAG_SYNC),
        idle: wordToBits(POCSAG_IDLE),
        wordsPerBatch: 16,
    };
}

export function inspectPocsagWord(word) {
    word = Number(word);
    if (!Number.isInteger(word) || word < 0 || word > 0xffffffff) {
        throw new Error("POCSAG word must be an unsigned 32-bit integer");
    }

    const value = word >>> 0;
    let ones = 0;
    for (let bit = 0; bit < 32; bit++) ones += (value >>> bit) & 1;

    return {
        word: value,
        hex: value.toString(16).padStart(8, "0"),
        bits: wordToBits(value),
        type: (value & 0x80000000) !== 0 ? "message" : "address",
        evenParity: (ones & 1) === 0,
    };
}

const pocsagReference = {
    id: "pocsag-reference",
    name: "POCSAG Reference / Inspector",
    description:
        "Non-transmitting POCSAG framing reference and 32-bit word inspector.",

    fields: [
        {
            id: "word",
            label: "32-bit word (hex)",
            type: "text",
            value: "7cd215d8",
        },
        {
            id: "invert",
            label: "Show inverted bits",
            type: "checkbox",
            value: false,
        },
    ],

    txMode: "direct",

    encode(values) {
        const text = String(values.word ?? "").trim().replace(/^0x/i, "");
        if (!/^[0-9a-fA-F]{1,8}$/.test(text)) {
            throw new Error("Enter a 1–8 digit hexadecimal POCSAG word");
        }

        const inspected = inspectPocsagWord(parseInt(text, 16));
        const bits = values.invert ? invertBits(inspected.bits) : inspected.bits;

        return {
            bytes: new Uint8Array(),
            inspected,
            bits,
            reference: buildPocsagReferenceBatch(),
            summary:
                `POCSAG inspect: 0x${inspected.hex.toUpperCase()} · ` +
                `${inspected.type} · even parity ${inspected.evenParity ? "yes" : "no"}`,
        };
    },
};

export default pocsagReference;
