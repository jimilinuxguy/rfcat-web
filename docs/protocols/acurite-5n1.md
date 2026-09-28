# Acurite 5n1

**Status: OTA validated**

The RFCat Web Acurite 5n1 temperature/humidity implementation has been
validated end-to-end using a YARD Stick One transmitter, RTL-SDR
receiver, and the native Acurite decoder in `rtl_433`.

The decoder reports `Integrity: CHECKSUM` for the generated packet.

## Known-Good Test Vector

Example configuration:

``` text
Channel:      A
Sequence:     0
Sensor ID:    0x123
Battery:      Good
Wind raw:     10
Temperature:  72.5 °F
Humidity:     50 %
```

Logical packet:

``` text
C1 23 78 81 28 65 B2 1C
```

Decoded result:

``` text
model         : Acurite-5n1
message_type  : 56
id            : 291
channel       : A
sequence_num  : 0
Battery       : 1
wind_speed    : 9.3 km/h
temperature   : 72.5 F
humidity      : 50 %
Integrity     : CHECKSUM
```

## Logical Packet

The implemented temperature/humidity message type is:

``` text
0x38
```

The generated packet is:

``` text
8 bytes
64 bits
```

It includes:

-   channel
-   sequence number
-   12-bit sensor ID
-   battery state
-   message type
-   wind value
-   temperature
-   humidity
-   parity
-   additive checksum

## Channel Encoding

Current channel bits:

``` text
A = 0xC0
B = 0x80
C = 0x00
```

The first byte also contains the sequence and upper sensor-ID bits.

## Parity

Data bytes that require protocol parity are generated with even parity.

The parity helper operates on the lower seven bits and sets bit 7 when
necessary to make the total number of set bits even.

## Checksum

The final byte is the 8-bit additive checksum of bytes 0 through 6:

``` text
checksum = sum(bytes[0..6]) & 0xFF
```

## Temperature

Temperature is represented using the protocol raw value:

``` text
tempRaw = round(temperatureF * 10 + 400)
```

The raw value is split across the appropriate packet fields.

## Humidity

Relative humidity is stored in the lower seven bits of its field with
protocol parity applied.

## Wind

The raw wind value is split across the wind fields before parity is
added.

## RF Configuration

Known-working configuration:

``` text
Frequency:          433.920 MHz
Modulation:         ASK/OOK
Requested rate:     9800 symbols/sec
CC1111 readback:    ~9796 symbols/sec
Hardware sync:      Disabled
Hardware Manchester: Disabled
RFCat outer repeat: 0
Frames:             3
```

The complete framing and PWM waveform are generated in software.

## Sync

Each frame begins with:

``` text
111111000000
```

At the configured symbol rate this produces the long sync pulse/gap
required by the slicer.

## PWM

The validated OTA mapping is:

``` text
logical 0 -> 110000
logical 1 -> 111100
```

This mapping may initially look inverted. It is intentional.

During development, the generic analyzer recovered the expected logical
packet while the native Acurite decoder remained silent. Inspection of
the decoder path showed that the Acurite decoder performs a bitbuffer
inversion before interpreting the packet.

The RF PWM polarity was therefore inverted while leaving the logical
packet builder unchanged.

That distinction is important:

``` text
packet semantics: unchanged
RF waveform polarity: inverted
```

## Frame Layout

Each frame contains:

``` text
12 sync symbols
+
64 logical bits × 6 RF symbols
=
396 RF symbols
```

The transmission contains three frames separated by a LOW gap:

``` text
SYNC + DATA
20 LOW symbols
SYNC + DATA
20 LOW symbols
SYNC + DATA
```

Total meaningful symbols:

``` text
396 × 3 + 20 × 2 = 1228
```

Four LOW padding symbols are added to reach a whole number of bytes:

``` text
1228 + 4 = 1232 symbols
1232 / 8 = 154 bytes
```

The three-frame waveform therefore fits in one RFCat transmit payload.

## Measured OTA Timing

Observed using RTL-SDR analysis:

``` text
short pulse:       ~220–228 µs
long pulse:        ~424–432 µs
bit period:        ~612 µs
sync pulse:        ~648 µs
sync gap:          ~588 µs
inter-frame gap:   ~2224 µs
```

Small variation is expected from SDR sample quantization and CC1111
data-rate quantization.

## Analyzer Verification

A captured transmission produced three clean 64-bit rows:

``` text
{64}c12378812865b21c
{64}c12378812865b21c
{64}c12378812865b21c
```

## Native Decoder Verification

Run:

``` bash
rtl_433 -f 433.92M -R 40 -vvv
```

The native decoder successfully reports all three frames as Acurite 5n1
messages with valid checksums.

## Development Lesson

Do not modify the packet builder to compensate for RF polarity.

The logical packet:

``` text
C1 23 78 81 28 65 B2 1C
```

is already correct.

Polarity belongs in the RF waveform encoder.

## Tests

Tests should verify at minimum:

-   8-byte logical packet
-   64 logical data bits
-   channel/sequence/sensor ID packing
-   temperature reconstruction
-   humidity
-   wind reconstruction
-   even parity
-   additive checksum
-   three RF frames
-   1228 meaningful RF symbols
-   154 transmitted bytes
-   4 padding symbols
-   sync prefix
-   validated inverted PWM mapping

For a packet beginning with logical bits `01`, the RF data immediately
after sync should begin:

``` text
110000111100
```

and the first 24 waveform symbols should be:

``` text
111111000000110000111100
```
