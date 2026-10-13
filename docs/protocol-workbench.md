# Protocol Reverse-Engineering Workbench (Milestone 5)

The RF Signal Analyzer now includes an offline, read-only bit inspector. Import a Flipper RAW `.sub`, choose a decode hypothesis, and click a bit (or enter a start index). Set a field width (1–64 bits), name and bit order, then **Add field**. Fields show their binary slice, hex and decimal values. Overlaps, duplicate names, invalid ranges and mismatched bit lengths are rejected.

**Inference & checks** compares the same decoding hypothesis across segmented frames with equal bit lengths. It highlights runs of changing bits, not their meaning. For byte-aligned candidates it checks whether the final byte equals a sum8 or xor8 over preceding bytes. These are deliberately *unverified hints*: incidental matches do not establish a checksum, counter, address, or protocol.

**Export definition JSON** downloads a versioned `rfcat-web.protocol.v1` schema with named bit ranges, bit order and candidate encoding. It is a portable analysis artifact, **not** an RF decoder or transmitter and is not automatically loaded as a radio preset. The preview shows up to 2,048 bits; exported field definitions use the complete candidate bitstream (up to 16,384 bits).

## Manual validation

1. Import a known RAW `.sub` fixture and select NRZ. Click a bit, choose width 8 and add an `address` field.
2. Add a non-overlapping `counter` field, then attempt an overlapping field and verify rejection.
3. Switch decode hypotheses; check that field values refresh. Import a new capture; field selections reset.
4. Compare repeated frames and verify variable runs; try unequal decoded frame lengths and verify the explicit alignment warning.
5. Export the JSON and inspect `schema`, `verified:false`, field ranges and encoding.
6. Open **? Help** and run the Protocol Reverse-Engineering tour. Test narrow viewport and keyboard navigation. Run `npm test`.

The analysis is offline and does not send RF commands. Real-world validation requires independent captures and controlled changes.

## Acceptance fixture: 01_ook_repeated_frames.sub

The repository includes `tests/fixtures/01_ook_repeated_frames.sub` (three synthetic, identical OOK frames). Expected: 433.920 MHz configured ASK/OOK, 116 total signed intervals, two 10,000 µs separator gaps, three frames of 38 intervals, and an estimated 500 µs unit. Each frame's NRZ candidate is `101010101010101010101010110011001011001010001110` (48 bits). The first 24 bits are `0xAAAAAA`, and the remaining 24 bits are `0xCCB28E`. The inference engine should report 48 stable bits and no variable runs. A unit test verifies parse, decode, field extraction and JSON schema round-trip. These are synthetic expectations, not verified over-the-air protocol semantics.
