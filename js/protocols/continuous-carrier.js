import { R } from "../radio/registers.js";

const continuousCarrier = {
    id: "continuous-carrier",
    name: "Continuous Carrier",

    description:
        "Continuous max-power RF carrier for bench testing.",

    /*
     * Direct protocols don't transmit a normal packet payload.
     */
    txMode: "direct",

    fields: [
        {
            id: "frequency",
            label: "Frequency",
            type: "number",
            default: 433.92,
            min: 300,
            max: 928,
            step: 0.001,
            suffix: "MHz",
        },
        {
            id: "duration",
            label: "Duration",
            type: "select",
            default: "5",
            options: [
                {
                    value: "1",
                    label: "1 second",
                },
                {
                    value: "5",
                    label: "5 seconds",
                },
                {
                    value: "10",
                    label: "10 seconds",
                },
                {
                    value: "30",
                    label: "30 seconds",
                },
            ],
        },
    ],

    /*
     * Direct TX still uses encode() for validation and to
     * resolve the values used by transmit().
     *
     * There is intentionally no packet payload.
     */
    encode(values) {
        const frequency = Number(values.frequency);

        const duration = Math.min(
            Math.max(
                Number(values.duration) || 5,
                1,
            ),
            30,
        );

        if (
            !Number.isFinite(frequency) ||
            frequency <= 0
        ) {
            throw new Error(
                "Invalid carrier frequency"
            );
        }

        return {
            bytes: new Uint8Array(0),
            frequency,
            duration,
            summary:
                `Continuous carrier · ` +
                `${frequency.toFixed(3)} MHz · ` +
                `${duration}s`,
        };
    },

    async configure(d, values) {
        const frequencyMHz =
            Number(values.frequency);

        /*
         * Frequency
         */
        await d.setFrequency(
            frequencyMHz * 1e6
        );

        /*
         * MDMCFG2.MOD_FORMAT = 3
         *
         * Select ASK/OOK while preserving the other
         * MDMCFG2 fields.
         */
        let mdmcfg2 =
            (await d.peek(R.MDMCFG2, 1))[0];

        mdmcfg2 =
            (mdmcfg2 & ~0x70) | 0x30;

        await d.poke(
            R.MDMCFG2,
            new Uint8Array([mdmcfg2]),
        );

        /*
         * Configure maximum PA power using the existing
         * RFCatUSB implementation.
         */
        await d.setMaxPower();

        /*
         * Enable the YARD Stick One RF amplifier.
         */
        await d.setAmpMode(true);
    },

    async transmit(d, encoded) {
        await d.startContinuousCarrier();

        try {
            await new Promise((resolve) =>
                setTimeout(
                    resolve,
                    encoded.duration * 1000,
                ),
            );
        } finally {
            /*
             * Always leave TX mode when the timer expires
             * or an exception occurs.
             */
            await d.stopContinuousCarrier();
        }

        return {
            summary:
                `Continuous carrier complete · ` +
                `${encoded.frequency.toFixed(3)} MHz · ` +
                `${encoded.duration}s`,
        };
    },
};

export default continuousCarrier;