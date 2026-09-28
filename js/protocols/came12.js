// Experimental CAME-12 waveform encoder.
// Kept pure so it can be tested without RF hardware.

export function encodeCame12(
    code,
    {
        samplesPerT = 1,
        repeats = 1,
        gapT = 47,
    } = {},
) {
    const clean = code.replace(/[\s_]/g, "");

    if (!/^[01]{12}$/.test(clean)) {
        throw new Error(
            "CAME-12 code must contain exactly 12 bits",
        );
    }

    const high = (n) =>
        "1".repeat(n * samplesPerT);

    const low = (n) =>
        "0".repeat(n * samplesPerT);

    let frame = "";

    for (const bit of clean) {
        frame +=
            bit === "0"
                ? high(1) + low(2)
                : high(2) + low(1);
    }

    let waveform = "";

    for (let i = 0; i < repeats; i++) {
        waveform += frame;

        if (i < repeats - 1) {
            waveform += low(gapT);
        }
    }

    const meaningfulSymbols = waveform.length;

    const padding =
        (8 - (waveform.length % 8)) % 8;

    waveform += "0".repeat(padding);

    const bytes =
        new Uint8Array(waveform.length / 8);

    for (let i = 0; i < waveform.length; i += 8) {
        bytes[i / 8] = parseInt(
            waveform.slice(i, i + 8),
            2,
        );
    }

    return {
        bytes,
        code: clean,
        waveform,
        meaningfulSymbols,
        frameSymbols: frame.length,
        repeats,
        padding,
    };
}


// ============================================================
// Protocol definition
// ============================================================

const came12 = {
    id: "came12",

    name: "CAME 12-bit",

    description:
        "Experimental 12-bit CAME ASK/OOK waveform generator.",

    fields: [
        {
            id: "code",
            label: "12-bit code",
            type: "text",
            placeholder: "101001011010",
            value: "101001011010",
        },
        {
            id: "repeats",
            label: "Bursts",
            type: "number",
            min: 1,
            max: 10,
            value: 3,
        },
        {
            id: "gapT",
            label: "Inter-burst gap (T)",
            type: "number",
            min: 0,
            value: 31,
        },
        {
            id: "repeat",
            label: "RFCat repeat",
            type: "number",
            min: 0,
            max: 100,
            value: 0,
        },
        {
            id: "offset",
            label: "RFCat offset",
            type: "number",
            min: 0,
            value: 0,
        },
    ],

    encode(values) {
        const encoded = encodeCame12(
            values.code,
            {
                samplesPerT: 1,
                repeats: Number(values.repeats),
                gapT: Number(values.gapT),
            },
        );

        return {
            ...encoded,

            summary:
                `CAME-12 TX: ` +
                `${encoded.code} · ` +
                `${encoded.repeats} bursts · ` +
                `${encoded.meaningfulSymbols + encoded.padding} symbols · ` +
                `${encoded.bytes.length} bytes`,
        };
    },

    async configure(device) {
        await device.mode(0x04);

        // 433.920 MHz
        await device.setFrequency(
            433_920_000,
        );

        // ASK/OOK
        await device.setModulation(
            0x30,
        );

        // One transmitted symbol ≈ 320 µs.
        await device.setDataRate(
            3125,
        );

        // No sync detection.
        await device.setSync(
            0x0000,
            0,
        );

        // The waveform is already encoded directly
        // into the transmitted bitstream.
        await device.setManchester(
            false,
        );
    },

    async transmit(device, encoded, values) {
        await device.configureAskOokPa?.();

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

export default came12;