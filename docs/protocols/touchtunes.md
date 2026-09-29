# TouchTunes Remote — The Fonz

**Status:** source-derived; unit-tested; OTA validation pending.

This module ports the normal command-transmission encoder from `The_Fonz.py`. It intentionally does **not** implement the source's PIN brute-force or continuous-carrier jamming/EW functions. Use transmission only with a jukebox or test receiver you own or are authorized to control.

## Source-derived frame

The source constructs a 32-bit logical frame:

```text
0x5D | PIN LSB-first | command | command XOR 0xFF
```

Each logical bit is then converted directly to OOK symbols:

```text
0 -> 10
1 -> 1000
```

The RF waveform is wrapped as:

```text
16 HIGH | 8 LOW | encoded 32-bit frame | 1000
```

The source configures RFCat for 433.92 MHz ASK/OOK at a data rate of 1766 symbols/s, giving a base symbol period of about 566.25 µs.

## UI

The protocol UI exposes the known remote PIN, command, and number of transmissions. The command selector preserves the command-byte table from the source.

## Validation

`tests/touchtunes.test.js` checks the frame layout, LSB-first PIN representation, command table, preamble/tail, and input validation.

`tools/generate-touchtunes-sample.mjs` generates a 1 Msps CU8 waveform for inspection:

```bash
node tools/generate-touchtunes-sample.mjs 0 44
```

The final two arguments are PIN (decimal) and command byte (hex).
