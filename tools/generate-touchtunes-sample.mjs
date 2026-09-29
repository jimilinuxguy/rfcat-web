import fs from "node:fs";
import path from "node:path";
import { encodeTouchTunes, TOUCHTUNES_SYMBOL_RATE } from "../js/protocols/touchtunes.js";

const SAMPLE_RATE = 1_000_000;
const OUTPUT_DIR = "tmp/touchtunes";
const PIN = Number(process.argv[2] ?? 0);
const COMMAND = Number.parseInt(process.argv[3] ?? "44", 16);
const encoded = encodeTouchTunes(PIN, COMMAND);
const symbolUs = 1_000_000 / TOUCHTUNES_SYMBOL_RATE;
const samplesPerSymbol = Math.round(SAMPLE_RATE * symbolUs / 1_000_000);
const silenceSamples = Math.round(SAMPLE_RATE * 0.005);
const totalSamples = silenceSamples * 2 + encoded.waveform.length * samplesPerSymbol;
const output = Buffer.alloc(totalSamples * 2);
let offset = 0;
const write = (i, q) => { output[offset++] = i; output[offset++] = q; };
for (let i = 0; i < silenceSamples; i++) write(127, 127);
for (const symbol of encoded.waveform) {
    for (let i = 0; i < samplesPerSymbol; i++) write(symbol === "1" ? 255 : 127, 127);
}
for (let i = 0; i < silenceSamples; i++) write(127, 127);
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const file = path.join(OUTPUT_DIR, `touchtunes_pin${PIN}_cmd${COMMAND.toString(16).padStart(2, "0")}_1Msps.cu8`);
fs.writeFileSync(file, output);
console.log(`file: ${file}`);
console.log(`PIN: ${PIN}`);
console.log(`command: 0x${COMMAND.toString(16).toUpperCase().padStart(2, "0")}`);
console.log(`logical bits: ${encoded.logicalBits}`);
console.log(`RF symbols: ${encoded.symbols}`);
console.log(`samples/symbol: ${samplesPerSymbol}`);
