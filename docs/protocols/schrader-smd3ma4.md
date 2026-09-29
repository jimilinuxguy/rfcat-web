# Schrader SMD3MA4 / NIS315G3

**Status:** Source-derived; unit-tested; synthetic/OTA validation pending.

This module implements the two `rtl_433` interpretations that share the same wire format: SMD3MA4 (Subaru) and MRXNIS315G3/3039 (Infiniti/Nissan/Renault/Redi-Sensor).

## Wire format

The source defines a 36-bit `0xF5555555E` preamble. Its final `10` pair is retained as the Manchester encoding of the fixed leading decoded `1`. The remaining 37 decoded bits are Manchester encoded with `01 → 0` and `10 → 1`.

Decoded data is 38 bits: fixed `1`, 3 flag bits, 24-bit sensor ID, 8-bit pressure, and 2 integrity bits. The integrity rule adds all 2-bit groups modulo 4 and requires the result to equal 1.

The two models differ only in pressure interpretation: SMD3MA4 uses 0.2 PSI/count; NIS315G3 uses 0.25 PSI/count. `rtl_433` explicitly notes that the RF payload itself cannot distinguish the two interpretations.

Nominal PCM/Manchester half-symbol timing is 120 µs and decoder reset is 480 µs. RFCat Web appends a 480 µs LOW reset tail to TX while keeping the preview limited to the 110 meaningful RF symbols.

The flags documented by the source are 0=learn, 3=alarm/pressure change, 5=wakeup, and 7=driving. No temperature is transmitted.
