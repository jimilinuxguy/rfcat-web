function positiveInteger(value, name) {
    value = Number(value);

    if (!Number.isInteger(value) || value < 1) {
        throw new Error(
            `${name} must be a positive integer`
        );
    }

    return value;
}

function appendPulse(symbols, highT, lowT) {
    symbols.push("1".repeat(highT));
    symbols.push("0".repeat(lowT));
}

/**
 * Encode a binary string as an OOK pulse-width waveform.
 *
 * Timings are expressed in multiples of T rather than seconds.
 *
 * Example:
 *
 *   0 -> HIGH 1T, LOW 3T
 *   1 -> HIGH 3T, LOW 1T
 *
 * The resulting waveform is packed MSB-first into bytes.
 */
export function encodeOokPwm(
    bits,
    {
        zero = [1, 3],
        one = [3, 1],
        sync = null,
        repeats = 1,
        gap = null,
    } = {},
) {
    bits = String(bits ?? "")
        .replace(/[\s_]/g, "");

    if (!bits.length) {
        throw new Error(
            "PWM input cannot be empty"
        );
    }

    if (!/^[01]+$/.test(bits)) {
        throw new Error(
            "PWM input may contain only 0 and 1"
        );
    }

    const zeroHigh = positiveInteger(
        zero[0],
        "zero HIGH",
    );

    const zeroLow = positiveInteger(
        zero[1],
        "zero LOW",
    );

    const oneHigh = positiveInteger(
        one[0],
        "one HIGH",
    );

    const oneLow = positiveInteger(
        one[1],
        "one LOW",
    );

    repeats = positiveInteger(
        repeats,
        "repeats",
    );

    const frames = [];

    for (let r = 0; r < repeats; r++) {
        const symbols = [];

        if (sync) {
            appendPulse(
                symbols,
                positiveInteger(sync[0], "sync HIGH"),
                positiveInteger(sync[1], "sync LOW"),
            );
        }

        for (const bit of bits) {
            if (bit === "0") {
                appendPulse(
                    symbols,
                    zeroHigh,
                    zeroLow,
                );
            } else {
                appendPulse(
                    symbols,
                    oneHigh,
                    oneLow,
                );
            }
        }

        if (gap) {
            appendPulse(
                symbols,
                positiveInteger(gap[0], "gap HIGH"),
                positiveInteger(gap[1], "gap LOW"),
            );
        }

        frames.push(symbols.join(""));
    }

    const waveform = frames.join("");

    const padding =
        (8 - (waveform.length % 8)) % 8;

    const padded =
        waveform + "0".repeat(padding);

    const bytes =
        new Uint8Array(padded.length / 8);

    for (let i = 0; i < padded.length; i += 8) {
        bytes[i / 8] =
            parseInt(
                padded.slice(i, i + 8),
                2,
            );
    }

    return {
        bytes,
        bits,
        waveform,
        symbols: waveform.length,
        padding,
        repeats,
    };
}