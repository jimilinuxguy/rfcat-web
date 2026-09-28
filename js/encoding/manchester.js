function cleanBits(bits) {
    const clean = String(bits ?? "")
        .replace(/[\s_]/g, "");

    if (!clean.length) {
        throw new Error("Manchester input cannot be empty");
    }

    if (!/^[01]+$/.test(clean)) {
        throw new Error(
            "Manchester input may contain only 0 and 1"
        );
    }

    return clean;
}

/**
 * Normal Manchester:
 *
 * logical 0 -> 01
 * logical 1 -> 10
 *
 * Each logical bit therefore becomes two RF symbols.
 */
export function encodeManchester(
    bits,
    {
        zero = "01",
        one = "10",
    } = {},
) {
    const clean = cleanBits(bits);

    let waveform = "";

    for (const bit of clean) {
        waveform += bit === "0"
            ? zero
            : one;
    }

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
        bits: clean,
        waveform,
        symbols: waveform.length,
        padding,
    };
}