import { buildWaveformAnalysis, bytesToBits } from "../encoding/waveform.js";

const PREAMBLE = "aaaaaa";
const SYNC_WORD = "fc2d";
const STATION_ID = "0";

function hex(value, width) {
    return Number(value)
        .toString(16)
        .padStart(width, "0")
        .toLowerCase();
}

function checksum(hexString) {
    if (hexString.length % 2 !== 0) {
        throw new Error("LRS checksum input must contain complete bytes");
    }

    let sum = 0;

    for (let i = 0; i < hexString.length; i += 2) {
        sum += parseInt(hexString.slice(i, i + 2), 16);
    }

    return sum % 255;
}

export function encodeLrsPager({
    restaurantId,
    pagerId,
    alertType,
}) {
    restaurantId = Number(restaurantId);
    pagerId = Number(pagerId);
    alertType = Number(alertType);

    if (!Number.isInteger(restaurantId) ||
        restaurantId < 0 ||
        restaurantId > 255) {
        throw new Error("Restaurant ID must be 0–255");
    }

    if (!Number.isInteger(pagerId) ||
        pagerId < 0 ||
        pagerId > 0xfff) {
        throw new Error("Pager ID must be 0–4095");
    }

    if (!Number.isInteger(alertType) ||
        alertType < 0 ||
        alertType > 255) {
        throw new Error("Alert type must be 0–255");
    }

    const restaurant = hex(restaurantId, 2);
    const pager = hex(pagerId, 3);
    const alert = hex(alertType, 2);

    /*
     * Matches the normal-page packet construction in lrs-ys1.py:
     *
     * pre
     * sync word
     * restaurant ID
     * station ID
     * pager ID
     * 0000000000
     * alert
     * checksum
     */

    const body =
        PREAMBLE +
        SYNC_WORD +
        restaurant +
        STATION_ID +
        pager +
        "0000000000" +
        alert;

    const crc = hex(checksum(body), 2);
    const packet = body + crc;

    const bytes = new Uint8Array(packet.length / 2);

    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(packet.slice(i * 2, i * 2 + 2), 16);
    }

    return {
        bytes,
        hex: packet,
        restaurantId,
        pagerId,
        alertType,
        checksum: crc,
    };
}

function parseLrsPayload(payload) {
    if (payload.length !== 10) return null;
    if (payload.slice(3, 8).some((value) => value !== 0)) return null;

    // The transmitted checksum covers the three AA preamble bytes, FC2D sync,
    // and the ten-byte payload up to (but not including) the checksum byte.
    let sum = 0xaa * 3 + 0xfc + 0x2d;
    for (let i = 0; i < 9; i++) sum += payload[i];
    if ((sum % 255) !== payload[9]) return null;

    const restaurantId = payload[0];
    const stationId = payload[1] >>> 4;
    const pagerId = ((payload[1] & 0x0f) << 8) | payload[2];
    const alertType = payload[8];
    return {
        fields: { restaurantId, stationId, pagerId, alertType, checksum: payload[9] },
        summary: `restaurant ${restaurantId} · station ${stationId} · pager ${pagerId} · alert ${alertType} · checksum ${payload[9].toString(16).padStart(2, "0").toUpperCase()}`,
    };
}

function parseLrsFrame(frame) {
    if (frame.length !== 15 ||
        frame[0] !== 0xaa || frame[1] !== 0xaa || frame[2] !== 0xaa ||
        frame[3] !== 0xfc || frame[4] !== 0x2d) return null;
    return parseLrsPayload(frame.slice(5));
}

function rawBits(bytes) {
    let out = "";
    for (const byte of bytes) out += byte.toString(2).padStart(8, "0");
    return out;
}

function decodeManchesterSamples(bits, phase, inverted = false, samplesPerChip = 4) {
    let decoded = "";
    const chip = (at) => {
        let ones = 0;
        for (let i = 0; i < samplesPerChip; i++) ones += bits[at + i] === "1" ? 1 : 0;
        const value = ones * 2 >= samplesPerChip ? "1" : "0";
        return inverted ? (value === "1" ? "0" : "1") : value;
    };
    for (let at = phase; at + samplesPerChip * 2 <= bits.length; at += samplesPerChip * 2) {
        const a = chip(at), b = chip(at + samplesPerChip);
        if (a === "0" && b === "1") decoded += "0";
        else if (a === "1" && b === "0") decoded += "1";
        else decoded += "?";
    }
    return decoded;
}

function bitsToCandidateBytes(bits, bitOffset = 0) {
    const out = [];
    for (let at = bitOffset; at + 8 <= bits.length; at += 8) {
        const byteBits = bits.slice(at, at + 8);
        if (byteBits.includes("?")) out.push(-1);
        else out.push(parseInt(byteBits, 2));
    }
    return out;
}

function runLengths(bits) {
    const runs = [];
    for (let start = 0; start < bits.length;) {
        const level = bits[start];
        let end = start + 1;
        while (end < bits.length && bits[end] === level) end++;
        runs.push({ level, samples: end - start });
        start = end;
    }
    return runs;
}

function manchesterChipsForBytes(bytes, inverted = false) {
    let chips = "";
    for (const byte of bytes) {
        for (let bit = 7; bit >= 0; bit--) {
            const one = (byte >>> bit) & 1;
            let pair = one ? "10" : "01";
            if (inverted) pair = pair === "10" ? "01" : "10";
            chips += pair;
        }
    }
    return chips;
}

const LRS_PREFIX = new Uint8Array([0xaa, 0xaa, 0xaa, 0xfc, 0x2d]);

function recoverAdaptiveLrs(bits) {
    const runs = runLengths(bits);
    if (runs.length < 20) return null;

    // The transmitter's Manchester chip clock is 625 baud. Capture raw at
    // 5000 baud (8 samples/chip) so clock phase and drift are observable instead
    // of trying to make one asynchronous RX sample represent one whole chip.
    // Keep the other ranges so saved captures from earlier experiments decode.
    const widthRanges = [
        [0.80, 1.20, 0.02],
        [1.70, 2.30, 0.025],
        [3.50, 4.50, 0.05],
        [7.00, 9.00, 0.10],
    ];
    for (const [minWidth, maxWidth, step] of widthRanges) {
      for (let width = minWidth; width <= maxWidth + 1e-9; width += step) {
        let chips = "";
        for (const run of runs) {
            const count = Math.max(1, Math.round(run.samples / width));
            // Huge idle/noise runs cannot belong to one LRS frame. Preserve a
            // separator so prefix matching cannot bridge across them.
            if (count > 12) {
                chips += "?";
                continue;
            }
            chips += run.level.repeat(count);
        }

        for (const inverted of [false, true]) {
            const prefix = manchesterChipsForBytes(LRS_PREFIX, inverted);
            let from = 0;
            while (from < chips.length) {
                const at = chips.indexOf(prefix, from);
                if (at < 0) break;
                let frameChips = chips.slice(at, at + 15 * 8 * 2);
                if (frameChips.length === 15 * 8 * 2 && !frameChips.includes("?")) {
                    if (inverted) {
                        frameChips = Array.from(frameChips, (bit) => bit === "0" ? "1" : "0").join("");
                    }
                    const logical = decodeManchesterChips(frameChips, 0);
                    if (!logical.includes("?")) {
                        const candidate = bitsToCandidateBytes(logical, 0);
                        if (candidate.length === 15) {
                            const parsed = parseLrsFrame(Uint8Array.from(candidate));
                            if (parsed) return parsed;
                        }
                    }
                }
                from = at + 1;
            }
        }
      }
    }
    return null;
}

function recoverTrackedLrs(bits) {
    const runs = runLengths(bits);
    if (runs.length < 20) return null;

    // Real 5000-baud captures show the apparent chip width walking across a
    // transmission (for example 0F/F0 -> 1F/E0 -> 3F/C0). Manchester limits a
    // valid run to one or two chips, so track that clock continuously instead
    // of forcing one width on the whole capture.
    for (let initialWidth = 3; initialWidth <= 9; initialWidth += 0.25) {
        for (const alpha of [0.08, 0.15, 0.25]) {
            let width = initialWidth;
            let chips = "";
            for (const run of runs) {
                const oneError = Math.abs(run.samples - width);
                const twoError = Math.abs(run.samples - 2 * width);
                const count = oneError <= twoError ? 1 : 2;
                const error = count === 1 ? oneError : twoError;

                // A run that is nowhere near one/two chips is a boundary/noise
                // separator. Re-seed after it rather than letting it drag the PLL.
                if (error > Math.max(2.5, width * 0.55)) {
                    chips += "?";
                    if (run.samples >= 3 && run.samples <= 9) width = run.samples;
                    continue;
                }

                chips += run.level.repeat(count);
                const measuredWidth = run.samples / count;
                width += alpha * (measuredWidth - width);
                width = Math.max(2.5, Math.min(10, width));
            }

            for (const inverted of [false, true]) {
                let tracked = chips;
                if (inverted) {
                    tracked = Array.from(tracked, (bit) =>
                        bit === "0" ? "1" : bit === "1" ? "0" : bit
                    ).join("");
                }
                for (let phase = 0; phase < 2; phase++) {
                    const parsed = findLrsFrame(decodeManchesterChips(tracked, phase));
                    if (parsed) return parsed;
                }
            }
        }
    }
    return null;
}

function recoverChipsFromRuns(bits, samplesPerChip = 4, inverted = false) {
    if (!bits.length) return "";
    let chips = "";
    for (const run of runLengths(bits)) {
        const chipCount = Math.max(1, Math.round(run.samples / samplesPerChip));
        const chip = inverted ? (run.level === "1" ? "0" : "1") : run.level;
        chips += chip.repeat(chipCount);
    }
    return chips;
}

function decodeManchesterChips(chips, phase = 0) {
    let decoded = "";
    for (let at = phase; at + 1 < chips.length; at += 2) {
        const pair = chips.slice(at, at + 2);
        if (pair === "01") decoded += "0";
        else if (pair === "10") decoded += "1";
        else decoded += "?";
    }
    return decoded;
}

function findLrsFrame(logical) {
    for (let bitOffset = 0; bitOffset < 8; bitOffset++) {
        const candidate = bitsToCandidateBytes(logical, bitOffset);
        for (let at = 0; at + 15 <= candidate.length; at++) {
            if (candidate[at] < 0) continue;
            const frame = Uint8Array.from(candidate.slice(at, at + 15));
            const parsed = parseLrsFrame(frame);
            if (parsed) return parsed;
        }
    }
    return null;
}

export function decodeLrsPager(bytes, { sampleScale = 1 } = {}) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("LRS RX payload must be a Uint8Array");

    // Live RX uses AA AA as the CC1111 sync word. Sync detection is required
    // for byte alignment; with sync disabled the packet engine starts fixed
    // packets at arbitrary bit boundaries. The first two AA bytes are stripped,
    // leaving AA FC 2D plus the ten-byte LRS payload.
    if (bytes.length === 13 &&
        bytes[0] === 0xaa && bytes[1] === 0xfc && bytes[2] === 0x2d) {
        const parsed = parseLrsPayload(bytes.slice(3));
        if (parsed) return parsed;
    }

    // Retain compatibility with the earlier FC2D hardware-sync experiment.
    if (bytes.length === 10) {
        const parsed = parseLrsPayload(bytes);
        if (parsed) return parsed;
    }

    // Keep support for complete reference frames and raw oversampled captures.
    for (let start = 0; start + 15 <= bytes.length; start++) {
        const parsed = parseLrsFrame(bytes.slice(start, start + 15));
        if (parsed) return parsed;
    }

    // Prefer adaptive transition-clock recovery. Live RX oversamples the
    // 625-baud Manchester chip stream at 5000 baud (nominally 8 samples/chip);
    // saved captures at the earlier rates remain supported.
    const bits = rawBits(bytes);
    const tracked = recoverTrackedLrs(bits);
    if (tracked) return tracked;

    const adaptive = recoverAdaptiveLrs(bits);
    if (adaptive) return adaptive;

    // Retain the fixed-phase and fixed-width fallbacks for clean/synthetic
    // captures and backwards compatibility.
    // First try fixed sample phases. Then recover chip timing from transition run
    // lengths so normal CC1111 clock jitter cannot accumulate across the frame.
    for (const inverted of [false, true]) {
        for (let phase = 0; phase < sampleScale * 2; phase++) {
            const parsed = findLrsFrame(decodeManchesterSamples(bits, phase, inverted, sampleScale));
            if (parsed) return parsed;
        }

        const chips = recoverChipsFromRuns(bits, sampleScale, inverted);
        for (let phase = 0; phase < 2; phase++) {
            const parsed = findLrsFrame(decodeManchesterChips(chips, phase));
            if (parsed) return parsed;
        }
    }
    return null;
}

// ============================================================
// Protocol definition
// ============================================================

const lrs = {
    id: "lrs",

    name: "LRS Pager",
    menuGroup: "Restaurant Pagers",

    decode: decodeLrsPager,

    rxPreset: {
        frequency: 467_750_000,
        // Match the known-good transmitter modem exactly. RFCat RX bytes come
        // from the CC1111 packet engine, not from an ADC/discriminator sampler,
        // so raising DRATE to 5000 does not create meaningful 8x samples.
        dataRate: 625,
        bandwidth: 93_750,
        modulation: 0x00,
        deviation: 15_000,
        // RX needs a sync word to establish byte boundaries. The transmitter
        // carries AA AA AA FC 2D inside its data, so lock on the first AA AA.
        // CC1111 strips those two sync bytes and returns the remaining 13 bytes:
        // AA FC 2D + the ten-byte LRS payload.
        syncWord: 0xaaaa,
        syncMode: 2,
        manchester: true,
        lengthMode: "fixed",
        packetLength: 13,
        crc: false,
        whitening: false,
        appendStatus: false,
        addressCheck: 0,
        deviceAddress: 0,
        lowball: false,
        sampleScale: 1,
    },

    description:
        "LRS pager packet generator using 467.750 MHz 2-FSK with Manchester encoding.",

    fields: [
        {
            id: "restaurantId",
            label: "Restaurant ID",
            type: "number",
            min: 0,
            max: 255,
            value: 1,
        },
        {
            id: "pagerId",
            label: "Pager ID",
            type: "number",
            min: 0,
            max: 4095,
            value: 1,
        },
        {
            id: "alertType",
            label: "Alert type",
            type: "select",
            value: "1",
            options: [
                {
                    value: "1",
                    label: "1",
                },
                {
                    value: "2",
                    label: "2",
                },
                {
                    value: "3",
                    label: "3",
                },
            ],
        },
        {
            id: "repeat",
            label: "Repeat count",
            type: "number",
            min: 0,
            max: 100,
            value: 4,
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
        const encoded = encodeLrsPager({
            restaurantId: values.restaurantId,
            pagerId: values.pagerId,
            alertType: values.alertType,
        });

        const bits = bytesToBits(encoded.bytes);
        let waveform = "";
        for (const bit of bits) waveform += bit === "0" ? "01" : "10";
        const analysis = buildWaveformAnalysis({
            waveform,
            symbolRate: 625,
            label: "LRS 2-FSK hardware Manchester",
            requestedTimings: [
                { name: "Manchester chip", symbols: 1, requestedUs: 1600 },
                { name: "Logical bit", symbols: 2, requestedUs: 3200 },
            ],
        });

        return {
            ...encoded,
            packetBytes: encoded.bytes,
            bits,
            waveform,
            padding: 0,
            analysis,
            modulation: "2-FSK · hardware Manchester · ±15 kHz",

            summary:
                `LRS TX: ` +
                `restaurant ${encoded.restaurantId} · ` +
                `pager ${encoded.pagerId} · ` +
                `alert ${encoded.alertType} · ` +
                `checksum ${encoded.checksum.toUpperCase()} · ` +
                `${encoded.bytes.length} bytes`,
        };
    },

    async configure(device) {
        await device.mode(0x04);

        // 467.750 MHz
        await device.setFrequency(
            467_750_000,
        );

        // 2-FSK
        await device.setModulation(
            0x00,
        );

        // 625 baud
        await device.setDataRate(
            625,
        );

        // ~15 kHz requested deviation.
        await device.setDeviation(
            15_000,
        );

        // No CC1111 sync detection.
        // The LRS sync bytes are part of the packet itself.
        await device.setSync(
            0x0000,
            0,
        );

        // LRS uses CC1111 Manchester encoding.
        await device.setManchester(
            true,
        );

        // Use the existing non-OOK PA setup.
        await device.setMaxPower();
    },

    async transmit(device, encoded, values) {
        await device.setPacketConfig({
            lengthMode: "fixed",
            packetLength: encoded.bytes.length,
            crc: false,
            whitening: false,
            appendStatus: false,
            addressCheck: 0,
            deviceAddress: 0,
        });
        // Refresh FSK PA state immediately before TX. This mirrors the
        // known-good ASK/OOK path and prevents stale PA state from a prior
        // modulation/configuration from carrying into packet transmission.
        await device.setMaxPower();
        await device.logTxDiagnostics?.("LRS PRE-TX");
        await device.setAmpMode(true);

        try {
            const repeat = Math.max(0, Math.trunc(Number(values.repeat ?? 0)));
            const offset = Number(values.offset ?? 0);
            for (let i = 0; i <= repeat; i++) {
                await device.transmit(encoded.bytes, 0, offset);
            }
        } finally {
            await device.setAmpMode(false);
        }
    },
};

export default lrs;