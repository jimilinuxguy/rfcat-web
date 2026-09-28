# LRS Pager

**Status: OTA validated**

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
Sync:                Disabled
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
