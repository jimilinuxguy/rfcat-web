import fs from "node:fs";
import path from "node:path";

import {
    buildSchraderMrxgg4Packet,
    SCHRADER_MRXGG4_HALF_BIT_US,
} from "../js/protocols/schrader-mrxgg4.js";

import { bytesToBits } from "../js/encoding/waveform.js";

const SAMPLE_RATE = 1_000_000;
const OUTPUT_DIR = "tmp/schrader-mrxgg4";

function encodeManchester(bits, inverted = false) {
    let waveform = "";

    for (const bit of bits) {
        // Candidate A:
        //   0 -> 01
        //   1 -> 10
        //
        // Candidate B is the exact inverse.
        let encoded = bit === "0" ? "01" : "10";

        if (inverted) {
            encoded = encoded
                .replaceAll("0", "x")
                .replaceAll("1", "0")
                .replaceAll("x", "1");
        }

        waveform += encoded;
    }

    return waveform;
}

function waveformToCu8(
    waveform,
    {
        sampleRate = SAMPLE_RATE,
        symbolUs = SCHRADER_MRXGG4_HALF_BIT_US,
        leadSilenceUs = 5000,
        trailSilenceUs = 5000,
    } = {},
) {
    const samplesPerSymbol = Math.round(
        sampleRate * symbolUs / 1_000_000
    );

    const leadSamples = Math.round(
        sampleRate * leadSilenceUs / 1_000_000
    );

    const trailSamples = Math.round(
        sampleRate * trailSilenceUs / 1_000_000
    );

    const totalSamples =
        leadSamples +
        waveform.length * samplesPerSymbol +
        trailSamples;

    // rtl_433 CU8:
    // unsigned 8-bit interleaved IQ samples.
    const output = Buffer.alloc(totalSamples * 2);

    let offset = 0;

    function writeSample(i, q) {
        output[offset++] = i;
        output[offset++] = q;
    }

    // No carrier / silence.
    for (let i = 0; i < leadSamples; i++) {
        writeSample(127, 127);
    }

    for (const symbol of waveform) {
        const high = symbol === "1";

        for (let i = 0; i < samplesPerSymbol; i++) {
            if (high) {
                // Constant complex carrier amplitude.
                writeSample(255, 127);
            } else {
                writeSample(127, 127);
            }
        }
    }

    for (let i = 0; i < trailSamples; i++) {
        writeSample(127, 127);
    }

    return {
        buffer: output,
        samplesPerSymbol,
        totalSamples,
    };
}

function writeCandidate(name, waveform) {
    const result = waveformToCu8(waveform);

    const filename =
        `schrader-mrxgg4-${name}_1Msps.cu8`;

    const filepath = path.join(
        OUTPUT_DIR,
        filename,
    );

    fs.writeFileSync(filepath, result.buffer);

    console.log("");
    console.log(`${name}:`);
    console.log(`  file: ${filepath}`);
    console.log(`  RF symbols: ${waveform.length}`);
    console.log(
        `  samples/symbol: ${result.samplesPerSymbol}`
    );
    console.log(
        `  duration: ${(result.totalSamples / SAMPLE_RATE * 1000).toFixed(2)} ms`
    );
    console.log(
        `  waveform: ${waveform.slice(0, 64)}...`
    );
}

fs.mkdirSync(OUTPUT_DIR, {
    recursive: true,
});

//
// rtl_433's example:
//
//   7 f6 70 3a 38 b2 00 49 49
//
// First nibble is the four decoded sync bits.
// Remaining eight bytes are the packet.
//

const packet = buildSchraderMrxgg4Packet({
    flags: 0x67,
    id: 0x03a38b2,
    pressureKPa: 0,
    temperatureC: 23,
});

const dataBits = bytesToBits(packet.bytes);

const logicalBits =
    "0111" + dataBits;

if (logicalBits.length !== 68) {
    throw new Error(
        `Expected 68 logical bits, got ${logicalBits.length}`
    );
}

const normal = encodeManchester(
    logicalBits,
    false,
);

const inverted = encodeManchester(
    logicalBits,
    true,
);

console.log("Schrader MRXGG4 synthetic capture");
console.log("--------------------------------");
console.log(`Packet bytes: ${
    [...packet.bytes]
        .map(b => b.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase()
}`);
console.log(`Logical bits: ${logicalBits.length}`);
console.log(`Half-bit: ${SCHRADER_MRXGG4_HALF_BIT_US} us`);
console.log(`Manchester symbols: ${normal.length}`);
console.log(`Sample rate: ${SAMPLE_RATE} Hz`);

writeCandidate(
    "normal",
    normal,
);

writeCandidate(
    "inverted",
    inverted,
);