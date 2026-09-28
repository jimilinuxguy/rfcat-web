 import test from "node:test";
import assert from "node:assert/strict";

import {
    buildAcurite5n1TempHumidity,
    encodeAcurite5n1Rf,
} from "../js/protocols/acurite-5n1.js";


test(
    "Acurite RF encoder produces 64 data bits",
    () => {
        const packet =
            buildAcurite5n1TempHumidity();

        const result =
            encodeAcurite5n1Rf(
                packet.bytes
            );

        assert.equal(
            result.bits.length,
            64,
        );
    },
);



test(
    "Acurite RF encoder uses MSB-first packet bits",
    () => {
        const packet =
            new Uint8Array([
                0x80,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
            ]);

        const result =
            encodeAcurite5n1Rf(packet);

        assert.equal(
            result.bits.slice(0, 8),
            "10000000",
        );
    },
);

test(
    "Acurite RF encoder produces three framed transmissions",
    () => {
        const packet =
            buildAcurite5n1TempHumidity();

        const result =
            encodeAcurite5n1Rf(
                packet.bytes
            );

        assert.equal(result.bits.length, 64);
        assert.equal(result.symbols, 1228);
        assert.equal(result.bytes.length, 154);
        assert.equal(result.padding, 4);

        // Sync is at the beginning.
        assert.equal(
            result.waveform.slice(0, 12),
            "111111000000",
        );
    },
);


test(
    "Acurite RF encoder uses correct PWM polarity",
    () => {
        const packet =
            new Uint8Array(8);

        // 0x40 starts with logical bits 01
        packet[0] = 0x40;

        const result =
            encodeAcurite5n1Rf(packet);

        // Skip the 12-symbol sync.
        //
        // 0 -> 111100
        // 1 -> 110000
        assert.equal(
            result.waveform.slice(12, 24),
            "110000111100",
        );
    },
);

test(
    "Acurite sync precedes packet data",
    () => {
        const packet =
            new Uint8Array(8);

        packet[0] = 0x40; // begins 01

        const result =
            encodeAcurite5n1Rf(packet);

        assert.equal(
            result.waveform.slice(0, 24),
            "111111000000110000111100",
        );
    },
);