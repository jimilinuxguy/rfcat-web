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

// ============================================================
// Protocol definition
// ============================================================

const lrs = {
    id: "lrs",

    name: "LRS Pager",
    menuGroup: "Restaurant Pagers",

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
            symbolRate: 1250,
            label: "LRS 2-FSK hardware Manchester",
            requestedTimings: [
                { name: "Manchester half-bit", symbols: 1, requestedUs: 800 },
                { name: "Logical bit", symbols: 2, requestedUs: 1600 },
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