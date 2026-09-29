import { buildWaveformAnalysis, bytesToBits } from "../encoding/waveform.js";

const TESLA_CHARGE_PORT_PACKET = new Uint8Array([
    0x15, 0x55, 0x55, 0x51, 0x59, 0x4c, 0xb5, 0x55, 0x52, 0xd5, 0x4b, 0x4a,
    0xd3, 0x4c, 0xab, 0x4b, 0x15, 0x94, 0xcb, 0x33, 0x33, 0x2d, 0x54, 0xb4,
    0x56, 0x9a, 0x65, 0x5a, 0x48, 0xac, 0xc6, 0x59, 0x99, 0x99, 0x69, 0xa5,
    0xb2, 0xb4, 0xd4, 0x2a, 0xd2, 0x80,
]);

export function encodeTeslaChargePort({ repeats = 5 } = {}) {
    repeats = Number(repeats);

    if (!Number.isInteger(repeats) || repeats < 1 || repeats > 6) {
        throw new Error("Tesla repeats must be between 1 and 6");
    }

    const bytes = new Uint8Array(TESLA_CHARGE_PORT_PACKET.length * repeats);

    for (let i = 0; i < repeats; i++) {
        bytes.set(
            TESLA_CHARGE_PORT_PACKET,
            i * TESLA_CHARGE_PORT_PACKET.length,
        );
    }

    return {
        bytes,
        repeats,
        frameLength: TESLA_CHARGE_PORT_PACKET.length,
        totalLength: bytes.length,
    };
}
// ============================================================
// Protocol definition
// ============================================================

const tesla = {
    id: "tesla",

    name: "Tesla Charge Port",

    description:
        "Tesla charge-port ASK/OOK transmitter for authorized testing.",

    fields: [
        {
            id: "frequency",
            label: "Frequency",
            type: "select",
            value: "433920000",
            options: [
                {
                    value: "433920000",
                    label: "433.920 MHz",
                },
                {
                    value: "315000000",
                    label: "315.000 MHz",
                },
            ],
        },
        {
            id: "repeats",
            label: "Frames",
            type: "number",
            min: 1,
            max: 6,
            value: 5,
        },
    ],

    encode(values) {
        const encoded = encodeTeslaChargePort({
            repeats: Number(values.repeats),
        });

        const waveform = bytesToBits(encoded.bytes);
        const analysis = buildWaveformAnalysis({
            waveform,
            symbolRate: 2500,
            label: "Tesla Charge Port ASK/OOK",
            requestedTimings: [
                { name: "RF symbol", symbols: 1, requestedUs: 400 },
            ],
        });

        return {
            ...encoded,
            packetBytes: TESLA_CHARGE_PORT_PACKET,
            bits: bytesToBits(TESLA_CHARGE_PORT_PACKET),
            waveform,
            padding: 0,
            analysis,
            modulation: "ASK/OOK",

            summary:
                `Tesla TX: ` +
                `${(Number(values.frequency) / 1_000_000).toFixed(3)} MHz · ` +
                `ASK/OOK · 2500 baud · ` +
                `${encoded.repeats} frames · ` +
                `${encoded.frameLength} bytes/frame · ` +
                `${encoded.totalLength} bytes total`,
        };
    },

    async configure(device, values) {
        await device.mode(0x04);

        // User-selectable frequency.
        // 433.920 MHz is the configuration from the
        // original TeslaPop implementation.
        await device.setFrequency(
            Number(values.frequency),
        );

        // ASK/OOK
        await device.setModulation(
            0x30,
        );

        // Original implementation uses 2500 baud.
        await device.setDataRate(
            2500,
        );

        // No hardware sync detection.
        await device.setSync(
            0x0000,
            0,
        );

        await device.setManchester(
            false,
        );
    },

    async transmit(device, encoded) {
        /*
         * Use the known-good ASK/OOK PA configuration.
         *
         * configureAskOokPa() should establish:
         *
         * PATABLE[0] = 0xC0
         * FREND0.PA_POWER = 1
         *
         * with PATABLE beginning at 0xDF2D.
         */
        await device.configureAskOokPa();
        await device.setAmpMode(true);

        try {
            /*
             * The encoder has already concatenated the
             * requested number of 42-byte frames.
             *
             * Therefore RFCat repeat must remain zero.
             */
            await device.transmit(
                encoded.bytes,
                0,
                0,
            );
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};

export default tesla;