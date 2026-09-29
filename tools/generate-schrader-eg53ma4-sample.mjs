import fs from "node:fs";
import path from "node:path";
import {
    SCHRADER_EG53MA4_HALF_BIT_US,
    buildSchraderEg53ma4Packet,
    buildSchraderEg53ma4LogicalFrame,
    encodeSchraderEg53ma4Manchester,
} from "../js/protocols/schrader-eg53ma4.js";

const SAMPLE_RATE = 1_000_000;
const OUTPUT_DIR = "tmp/schrader-eg53ma4";

function waveformToCu8(waveform, leadSilenceUs = 5000, trailSilenceUs = 5000) {
    const samplesPerSymbol = Math.round(SAMPLE_RATE * SCHRADER_EG53MA4_HALF_BIT_US / 1_000_000);
    const lead = Math.round(SAMPLE_RATE * leadSilenceUs / 1_000_000);
    const trail = Math.round(SAMPLE_RATE * trailSilenceUs / 1_000_000);
    const out = Buffer.alloc((lead + waveform.length * samplesPerSymbol + trail) * 2);
    let o = 0;
    const sample = (i, q) => { out[o++] = i; out[o++] = q; };
    for (let i = 0; i < lead; i++) sample(127, 127);
    for (const symbol of waveform) {
        for (let i = 0; i < samplesPerSymbol; i++) sample(symbol === "1" ? 255 : 127, 127);
    }
    for (let i = 0; i < trail; i++) sample(127, 127);
    return { out, samplesPerSymbol };
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const packet = buildSchraderEg53ma4Packet({
    flags: 0x4c900010,
    id: 0x00c169,
    pressureKPa: 237.5,
    temperatureF: 93,
});
const bits = buildSchraderEg53ma4LogicalFrame(packet.bytes);
const rf = encodeSchraderEg53ma4Manchester(bits);
const { out, samplesPerSymbol } = waveformToCu8(rf.waveform);
const file = path.join(OUTPUT_DIR, "schrader-eg53ma4_1Msps.cu8");
fs.writeFileSync(file, out);
console.log(`Packet: ${[...packet.bytes].map(b => b.toString(16).padStart(2,"0")).join(" ").toUpperCase()}`);
console.log(`Logical bits: ${bits.length}`);
console.log(`RF half-symbols: ${rf.symbols}`);
console.log(`Half-bit: ${SCHRADER_EG53MA4_HALF_BIT_US} us`);
console.log(`Samples/symbol: ${samplesPerSymbol}`);
console.log(`File: ${file}`);
