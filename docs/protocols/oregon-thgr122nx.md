# Oregon Scientific THGR122NX

**Status: Experimental**

RFCat Web contains an experimental Oregon Scientific THGR122NX
v2.1-style weather-sensor encoder.

The current implementation is useful as a protocol-development
foundation but has not yet reached the same independent
receiver-validation level as Acurite 5n1.

## Current Frame Model

The implementation constructs a 24-nibble logical frame.

Current field organization:

``` text
0..3   preamble
4      sync
5..8   sensor ID
9      channel
10..11 rolling ID
12     flags / battery
13     temperature tenths
14     temperature ones
15     temperature tens
16     temperature sign
17     humidity ones
18     humidity tens
19     status / unknown
20..21 checksum
22..23 CRC
```

## Preamble and Sync

Current logical values:

``` text
Preamble: F F F F
Sync:     A
```

## Sensor ID

Current THGR122NX sensor-ID nibbles:

``` text
1 D 2 0
```

## Channel

Current mapping uses:

``` text
1 << (channel - 1)
```

for channels 1 through 3.

## Battery

The current low-battery flag uses:

``` text
0x4
```

in the flags nibble.

## Serialization

Each nibble is serialized least-significant-bit first.

The 24-nibble frame therefore produces:

``` text
96 logical bits
```

## Manchester Encoding

The current Oregon waveform uses protocol-specific Manchester polarity:

``` text
0 -> 10
1 -> 01
```

The resulting waveform contains:

``` text
192 RF symbols
24 packed bytes
```

The first `F` nibble produces an alternating RF pattern:

``` text
01010101
```

## Radio Configuration

Current configuration:

``` text
Frequency:           433.920 MHz
Modulation:          ASK/OOK
RF data rate:        2048 symbols/sec
Logical rate:        ~1024 bits/sec
Hardware sync:       Disabled
Hardware Manchester: Disabled
```

Manchester is generated in software.

## Checksum / CRC

The implementation contains checksum and CRC helpers as part of the
experimental frame model.

These should not yet be treated as fully receiver-validated protocol
documentation.

Before declaring this protocol OTA validated, compare generated frames
against authoritative captures and confirm decoding by an independent
implementation or physical receiver.

## Current Validation

Unit tests verify structural properties including:

-   24-nibble frame
-   96 logical bits
-   192 Manchester RF symbols
-   24 output bytes
-   no byte padding
-   expected alternating preamble waveform

SDR captures have shown the expected alternating preamble behavior, but
complete receiver interoperability remains experimental.
