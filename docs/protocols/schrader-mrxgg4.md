# Schrader TPMS --- MRXGG4

**Status:** OTA validated against `rtl_433` decoder #60.

RFCat Web implements the Schrader/MRXGG4 format represented by the
generic Schrader decoder in `rtl_433`'s `schraeder.c`.

## Frame

The decoder consumes 68 logical bits. The first four bits are a sync
nibble and the remaining 64 bits are eight packet bytes.

The known-answer packet used during development is:

``` text
Sync: 7
Data: F6 70 3A 38 B2 00 49 49
```

It represents flags `67`, sensor ID `03A38B2`, pressure `0.0 kPa`,
temperature `23 °C`, and a valid CRC.

## Integrity

MRXGG4 uses CRC-8 with polynomial `0x07` and initial value `0xF0`.

## RF Encoding

-   ASK/OOK
-   Manchester zero-bit
-   Logical `0` → RF half-symbols `01`
-   Logical `1` → RF half-symbols `10`
-   Nominal half-bit: `120 µs`
-   68 logical bits → 136 RF half-symbols → 17 bytes
-   Hardware Manchester: disabled
-   Hardware sync: disabled

The Manchester polarity was validated first using a generated CU8 IQ
sample. The normal mapping decoded successfully through `rtl_433`; the
inverted candidate did not.

## OTA Validation

A YARD Stick One transmission of the known-answer frame was received
independently and decoded by `rtl_433` decoder #60 with a valid CRC.

Do not change the packet layout, CRC, Manchester polarity, or validated
TX framing without re-running both synthetic and OTA validation.

## UI

Sensor ID and flags are entered in hexadecimal so values correspond
directly to `rtl_433` output. Pressure and temperature remain numeric
engineering values.

## Safety

Transmit only to equipment you own or are explicitly authorized to test.
