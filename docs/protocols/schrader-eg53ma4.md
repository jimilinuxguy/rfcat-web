# Schrader TPMS --- EG53MA4

**Status:** OTA validated against `rtl_433` decoder #95.

RFCat Web implements the Schrader EG53MA4 format used by the tested 315
MHz TPMS sensor application.

## Logical Frame

The decoder expects 120 logical bits:

``` text
40-bit prefix | 32-bit flags | 24-bit ID | pressure | temperature | checksum
```

A genuine captured sensor frame used during validation was:

``` text
00000000004c90001000c1695f5bd0
```

The first 40 decoded bits were observed as zero in the tested sensor
transmission.

The OTA RFCat validation vector was:

``` text
00000000004c90001000c1695f5dd2
```

which represents flags `4C900010`, sensor ID `00C169`, pressure
`237.5 kPa`, temperature `93 °F`, and checksum `D2`.

## Field Encoding

-   Flags: 32-bit value
-   Sensor ID: 24-bit value
-   Pressure raw value: `pressure_kPa / 2.5`
-   Temperature: one-byte Fahrenheit value
-   Checksum: sum of the first nine data bytes modulo 256

## RF Encoding

-   Tested carrier: 315 MHz
-   ASK/OOK
-   Manchester zero-bit
-   Logical `0` → RF half-symbols `01`
-   Logical `1` → RF half-symbols `10`
-   Nominal half-bit from decoder definition: `123 µs`
-   Requested symbol rate: approximately `8130.08 symbols/s`
-   CC1111 configured rate during validation: approximately
    `8125 symbols/s`
-   Hardware Manchester: disabled
-   Hardware sync: disabled
-   120 logical bits → 240 protocol half-symbols → 30 protocol bytes

The genuine Silverado sensor analyzer measurement reported approximately
`128 µs` short width. The YARD Stick waveform decoded correctly at
approximately `136 µs` analyzer short width; therefore the validated
implementation should not be retuned solely to force the analyzer number
to equal the nominal decoder width.

## Required TX Reset Tail

The first OTA attempt produced the correct 120-bit frame followed by an
unwanted extra decoded bit:

``` text
{121}00000000004c90001000c1695f5dd28
```

Appending eight LOW half-symbols to the 240-symbol protocol waveform
created an explicit reset period of approximately `984 µs` and fixed
packet termination:

``` text
{120}00000000004c90001000c1695f5dd2
```

The resulting TX buffer is therefore 31 bytes:

``` text
30 bytes validated Manchester frame
+ 1 byte LOW reset tail
= 31 TX bytes
```

Keep the protocol waveform/preview at 240 meaningful symbols; the LOW
reset byte is transport termination, not protocol payload.

## OTA Validation

After adding the LOW reset tail, `rtl_433 -R 95` independently decoded
the YARD Stick transmission as `Schrader-EG53MA4` with flags `4c900010`,
ID `00C169`, pressure `237.5 kPa`, temperature `93.0 F`, and
`Integrity: CHECKSUM`.

This validates packet construction, checksum, prefix, Manchester
encoding, RF timing, ASK/OOK transmission, and packet termination for
the tested setup.

## UI

Flags and sensor ID are entered in hexadecimal to match `rtl_433` output
directly:

``` text
Flags:     4C900010
Sensor ID: 00C169
```

Pressure remains in kPa and temperature remains in °F.

## Safety

Transmit only to equipment you own or are explicitly authorized to test.
