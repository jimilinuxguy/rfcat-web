function cleanBinary(value) {
    return String(value ?? "").replace(/\s+/g, "");
}

export function parseBinarySymbols(value) {
    const bits = cleanBinary(value);

    if (!bits.length) {
        throw new Error("Enter at least one binary symbol");
    }

    if (!/^[01]+$/.test(bits)) {
        throw new Error("Binary payload may contain only 0 and 1");
    }

    const paddedLength = Math.ceil(bits.length / 8) * 8;
    const padded = bits.padEnd(paddedLength, "0");

    const bytes = new Uint8Array(padded.length / 8);

    for (let i = 0; i < padded.length; i += 8) {
        bytes[i / 8] = parseInt(padded.slice(i, i + 8), 2);
    }

    return {
        bytes,
        symbols: bits.length,
        paddedSymbols: padded.length,
        padding: padded.length - bits.length,
    };
}

const binary = {
    id: "binary",

    name: "Binary OOK",

    description:
        "Transmit a raw binary symbol stream packed MSB-first into bytes.",

    fields: [
        {
            id: "symbols",
            label: "Binary symbols",
            type: "textarea",
            rows: 4,
            placeholder: "11110000 11001100 10101010",
            value: "",
        },
        {
            id: "repeat",
            label: "Repeat",
            type: "number",
            min: 0,
            max: 100,
            value: 0,
        },
        {
            id: "offset",
            label: "Offset",
            type: "number",
            min: 0,
            value: 0,
        },
    ],

    encode(values) {
        const encoded = parseBinarySymbols(values.symbols);

        return {
            ...encoded,

            summary:
                `Binary TX: ${encoded.symbols} symbols · ` +
                `${encoded.bytes.length} bytes` +
                (encoded.padding
                    ? ` · ${encoded.padding} padding bits`
                    : ""),
        };
    },

    async transmit(device, encoded, values) {
        await device.transmit(
            encoded.bytes,
            Number(values.repeat ?? 0),
            Number(values.offset ?? 0),
        );
    },
};

export default binary;