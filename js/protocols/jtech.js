import { buildJtechLegacyAlert } from "./pocsag.js";
import { buildWaveformAnalysis } from "../encoding/waveform.js";

const jtech = {
    id: "jtech",
    name: "JTECH Pager",
    menuGroup: "Restaurant Pagers",
    description: "JTECH restaurant pager reference waveform generator.",
    fields: [
        { id: "frequency", label: "Frequency (Hz)", type: "number", min: 1, value: 457600000 },
        {
            id: "legacyReference",
            label: "JTECH Restaurant Pager",
            type: "select",
            value: "79984",
            options: [
                { value: "79984", label: "79984 (Not Lost)" },
                { value: "79992", label: "79992 (All)" },
            ],
        },
        { id: "repeat", label: "RFCat repeat", type: "number", min: 0, max: 100, value: 0 },
        { id: "offset", label: "RFCat offset", type: "number", min: 0, value: 0 },
    ],
    encode(values) {
        const encoded = buildJtechLegacyAlert(values.legacyReference);
        const analysis = buildWaveformAnalysis({
            waveform: encoded.bits,
            symbolRate: 512,
            label: "JTECH 2-FSK",
            requestedTimings: [{ name: "Bit", symbols: 1, requestedUs: 1_000_000 / 512 }],
        });
        return {
            ...encoded, packetBytes: encoded.bytes, waveform: encoded.bits, analysis,
            modulation: "2-FSK",
            summary: `JTECH legacy TX: reference capcode ${encoded.capcode} · 512 baud · ${encoded.bytes.length} bytes`,
        };
    },
    async configure(device, values) {
        await device.mode(0x04);
        await device.setFrequency(Number(values.frequency));
        await device.setModulation(0x00);
        await device.setDataRate(512);
        await device.setDeviation(4500);
        await device.setSync(0x0000, 0);
        await device.setManchester(false);
        await device.setMaxPower();
    },
    async transmit(device, encoded, values) {
        await device.setPacketConfig({ lengthMode: "fixed", packetLength: encoded.bytes.length, crc: false, whitening: false, appendStatus: false, addressCheck: 0, deviceAddress: 0 });
        await device.logTxDiagnostics?.("JTECH PRE-TX");
        await device.setAmpMode(true);
        try { await device.transmit(encoded.bytes, Number(values.repeat ?? 0), Number(values.offset ?? 0)); }
        finally { await device.mode(0x04); await device.setAmpMode(false); }
    },
};
export default jtech;
