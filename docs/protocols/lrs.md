# LRS Pager

**Status: TX/RX OTA validated with YARD Stick One hardware**

RFCat Web implements LRS pager packet construction and transmission for
authorized testing with equipment the operator owns or is permitted to
test.

## Radio Configuration

Known-working configuration:

``` text
Frequency:           467.750 MHz
Modulation:          2-FSK
Data rate:           625 baud
Requested deviation: 15 kHz
Measured/configured:  ~14.648 kHz
Manchester:          Enabled
TX sync:             Disabled
RX hardware sync:    AA AA (16/16)
RX packet length:    13 bytes
```

The external amplifier is enabled around transmission and disabled
afterward.

## Packet Structure

The implemented packet is constructed from:

``` text
AA AA AA
FC 2D
restaurant ID
station/pager fields
reserved fields
alert
checksum
```

A known-good example for restaurant ID 1, pager ID 1, alert 1 is:

``` text
AA AA AA FC 2D 01 00 01 00 00 00 00 00 01 2D
```

## Checksum

The checksum is calculated by summing each byte of the packet before the
checksum and taking:

``` text
sum % 255
```

The resulting byte is appended to the packet.

## OTA Verification

The known-good packet was captured independently using an RTL-SDR and
Universal Radio Hacker.

Working URH settings included:

``` text
Center frequency:   467.750 MHz
Sample rate:        1.0 MS/s
Bandwidth:          200 kHz
Modulation:         FSK
Bits per symbol:    1
Samples per symbol: 1600
Encoding:           Manchester II
```

The OTA capture recovered repeated copies of:

``` text
aaaaaafc2d0100010000000000012d
```

matching the generated packet.

## Scope

The web implementation intentionally focuses on explicit packet
construction and transmission for authorized protocol testing rather
than automated scanning or brute-force functionality.

## Receive Decoding

LRS receive support uses the CC1111 packet engine rather than software oversampling. The receiver is configured at the transmitter's 625-baud modem rate with hardware Manchester decoding enabled.

For reliable byte alignment, RX uses `AA AA` as a 16/16 hardware sync word. The CC1111 consumes those two sync bytes and returns the remaining 13 bytes:

``` text
AA FC 2D 01 00 01 00 00 00 00 00 01 2D
```

RFCat Web only identifies a packet as LRS when the 13-byte header and field layout match and the checksum validates. Hardware sync can occasionally false-lock or produce a corrupted 13-byte packet; those packets are rejected rather than reported as decoded LRS pages.

Live YARD Stick One testing recovered repeated transmissions as individual 13-byte receive events and decoded the known-good restaurant 1 / station 0 / pager 1 / alert 1 frame with checksum `2D`.

Earlier experimental 5000-baud software oversampling and Manchester timing-recovery paths were removed after OTA testing established that RFCat receives CC1111 packet-engine output, not raw discriminator/ADC samples.
