import {
    encodeOokPwm,
} from "../encoding/pwm.js";


function parseTiming(value, name) {
    const n = Number(value);

    if (!Number.isInteger(n) || n < 1) {
        throw new Error(
            `${name} must be a positive integer`
        );
    }

    return n;
}


const pwm = {
    id: "pwm",

    name: "Generic OOK / PWM",

    description:
        "Generate a configurable OOK pulse-width waveform for RF testing.",

    fields: [
        {
            id: "bits",
            label: "Bits",
            type: "textarea",
            rows: 3,
            value: "01010101",
            placeholder: "01010101",
        },
        {
            id: "frequency",
            label: "Frequency (MHz)",
            type: "number",
            min: 300,
            max: 928,
            step: 0.001,
            value: 433.920,
        },
        {
            id: "symbolRate",
            label: "Symbol Rate (T/sec)",
            type: "number",
            min: 1,
            max: 100000,
            step: 1,
            value: 3125,
        },
        {
            id: "zeroHigh",
            label: "0 HIGH (T)",
            type: "number",
            min: 1,
            max: 100,
            value: 1,
        },
        {
            id: "zeroLow",
            label: "0 LOW (T)",
            type: "number",
            min: 1,
            max: 100,
            value: 3,
        },
        {
            id: "oneHigh",
            label: "1 HIGH (T)",
            type: "number",
            min: 1,
            max: 100,
            value: 3,
        },
        {
            id: "oneLow",
            label: "1 LOW (T)",
            type: "number",
            min: 1,
            max: 100,
            value: 1,
        },
        {
            id: "repeats",
            label: "Repeats",
            type: "number",
            min: 1,
            max: 20,
            value: 1,
        },
    ],

    encode(values) {
        const zero = [
            parseTiming(
                values.zeroHigh,
                "0 HIGH",
            ),
            parseTiming(
                values.zeroLow,
                "0 LOW",
            ),
        ];

        const one = [
            parseTiming(
                values.oneHigh,
                "1 HIGH",
            ),
            parseTiming(
                values.oneLow,
                "1 LOW",
            ),
        ];

        const result = encodeOokPwm(
            values.bits,
            {
                zero,
                one,
                repeats: Number(values.repeats),
            },
        );

        return {
            ...result,

            summary:
                `PWM TX: ${result.bits.length} bits · ` +
                `${result.symbols} symbols · ` +
                `${result.bytes.length} bytes · ` +
                `${result.repeats} repeat(s)`,
        };
    },

    async configure(device, values) {
        const frequencyMHz =
            Number(values.frequency);

        const symbolRate =
            Number(values.symbolRate);

        if (
            !Number.isFinite(frequencyMHz) ||
            frequencyMHz <= 0
        ) {
            throw new Error(
                "Frequency must be a positive number"
            );
        }

        if (
            !Number.isFinite(symbolRate) ||
            symbolRate <= 0
        ) {
            throw new Error(
                "Symbol rate must be a positive number"
            );
        }

        await device.mode(0x04);

        await device.setFrequency(
            frequencyMHz * 1_000_000,
        );

        // ASK / OOK
        await device.setModulation(0x30);

        await device.setDataRate(
            symbolRate,
        );

        // Raw symbol stream:
        // no hardware sync or Manchester encoding.
        await device.setSync(
            0x0000,
            0,
        );

        await device.setManchester(
            false,
        );

        // Establish the known-good ASK/OOK PA state.
        await device.configureAskOokPa();
    },

    async transmit(
        device,
        encoded,
        values,
    ) {
        await device.setAmpMode(true);

        try {
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


export default pwm;