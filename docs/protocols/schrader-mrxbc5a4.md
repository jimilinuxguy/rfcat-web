# Schrader MRXBC5A4 / MRXBMW433TX1

**Status:** Source-derived; unit-tested; synthetic/OTA validation pending.

This is the BMW Schrader TPMS format from the pinned `rtl_433` `schraeder.c` implementation.

## Decoder-effective frame

The decoder requires a 61-bit row beginning with fixed prefix `0111111111111111`, followed by 3 flags, 24-bit ID, 9-bit pressure in kPa, 2 integrity bits, and the temperature bits consumed by the implementation.

The source prose describes an 8-bit temperature field, but the decoder checks 61 total bits and its extraction expression effectively consumes seven temperature bits. RFCat Web follows the executable decoder behavior rather than inventing a 62nd bit. This limits generated temperatures to -40..77 °C under the decoder's plausibility rules.

The 2-bit integrity check is evaluated over the decoder's 35-bit ID+pressure+check region using `(even_ones + 2*n - 1) mod 4`. Because the check bits participate in that expression, not every arbitrary ID/pressure pair admits a fixed-point value. The encoder searches all four check values and rejects combinations for which the pinned decoder would reject every candidate.

Nominal Manchester half-bit timing is 123 µs and reset is 800 µs. RFCat Web appends eight LOW half-symbols (~984 µs) to the TX buffer for deterministic termination. This termination choice is implementation-derived and still requires OTA validation.

Flag value `2` is reported by `rtl_433` as sleep ACK.
