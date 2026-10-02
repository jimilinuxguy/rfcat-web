import { buildWaveformAnalysis, bytesToBits } from "../encoding/waveform.js";

export const RETEKESS_T112_PAGER_69 = new Uint8Array([
    0x00, 0xaa, 0x88, 0x8e, 0x8e, 0x8e, 0xee, 0x8e,
    0x8e, 0x88, 0x8e, 0x88, 0x88, 0x88, 0x88,
]);

export function encodeRetekessT112Pager69() {
    const bytes = RETEKESS_T112_PAGER_69.slice();
    return {
        bytes,
        hex: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
        pagerId: 69,
    };
}

const retekessT112 = {
    id: "retekess-t112",
    name: "Retekess T112 Pager 69",
    menuGroup: "Restaurant Pagers",
    description: "Fixed Pager 69 reference waveform from the published Retekess T112 RFCat script.",

    fields: [
        {
            id: "repeat",
            label: "Repeat count",
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

    encode() {
        const encoded = encodeRetekessT112Pager69();
        const waveform = bytesToBits(encoded.bytes);
        return {
            ...encoded,
            bits: waveform,
            waveform,
            padding: 0,
            modulation: "ASK/OOK",
            analysis: buildWaveformAnalysis({
                waveform,
                symbolRate: 3060,
                label: "Retekess T112 Pager 69 reference waveform",
                requestedTimings: [
                    { name: "Reference symbol", symbols: 1, requestedUs: 327 },
                ],
            }),
            summary: `Retekess T112 TX: Pager 69 · fixed reference · ${encoded.bytes.length} bytes`,
        };
    },

    async configure(device) {
        await device.mode(0x04);
        await device.setFrequency(433_920_000);
        await device.setModulation(0x30);
        await device.setDataRate(3060);
        await device.setSync(0x0000, 0);
        await device.setManchester(false);
    },

    async transmit(device, encoded, values) {
        await device.configureAskOokPa?.();
        await device.setAmpMode(true);
        try {
            const repeat = Math.max(0, Math.trunc(Number(values.repeat ?? 0)));
            const offset = Number(values.offset ?? 0);
            for (let i = 0; i <= repeat; i++) {
                await device.transmit(encoded.bytes, 0, offset);
            }
        } finally {
            await device.mode(0x04);
            await device.setAmpMode(false);
        }
    },
};

export default retekessT112;
