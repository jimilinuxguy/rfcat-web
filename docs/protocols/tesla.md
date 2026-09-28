# Tesla Charge Port

**Status: Implemented / waveform validated during development**

This module reproduces the fixed ASK/OOK waveform used by the reference
YARD Stick One implementation for authorized interoperability testing
with user-owned or otherwise authorized vehicles and hardware.

## Radio Configuration

Reference configuration:

``` text
Frequency:           433.920 MHz
Modulation:          ASK/OOK
Data rate:           2500 baud
Sync:                Disabled
Manchester:          Disabled
Frame size:          42 bytes
Default frames:      5
RFCat outer repeat:  0
```

An optional 315 MHz selection is exposed for user-directed authorized
testing; 433.920 MHz is the source/reference configuration.

## Frame

The fixed 42-byte frame is:

``` text
15 55 55 51 59 4C B5 55
52 D5 4B 4A D3 4C AB 4B
15 94 CB 33 33 2D 54 B4
56 9A 65 5A 48 AC C6 59
99 99 69 A5 B2 B4 D4 2A
D2 80
```

Five copies produce:

``` text
42 × 5 = 210 bytes
```

Because RFCat transmission payloads are limited, the UI constrains the
number of copies so the combined waveform remains within the supported
payload.

## ASK/OOK PA

Tesla transmission uses the dedicated ASK/OOK PA configuration:

``` text
PATABLE base = 0xDF2D
PATABLE[0]   = 0xC0
FREND0       = 0x11
```

This is important. Using the wrong PATABLE address produced a nearly
continuous carrier rather than the intended waveform.

## Transmission Cleanup

The external amplifier is enabled immediately before transmission and
disabled in a `finally` block after returning the radio to idle.

## SDR Verification

During development, the captured waveform aligned with the expected
336-bit frame at the configured 2500-symbol/sec rate. Minor
leading/trailing bit differences can occur at the demodulator capture
boundary.
