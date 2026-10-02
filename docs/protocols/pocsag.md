# POCSAG Pager

**Status: POCSAG512 TX and RX OTA validated with YARD Stick One hardware**

RFCat Web includes a generic POCSAG transmitter and receiver for authorized paging-system development and interoperability testing.

## Transmitter

The transmitter builds POCSAG pages from an explicit capcode and function value. It does not discover, enumerate, or sweep capcodes.

Implemented framing:

```text
Preamble:        576 alternating bits
Sync codeword:   0x7CD215D8
Batch:           16 x 32-bit codewords
Idle codeword:   0x7A89C197
Address BCH:     BCH(31,21), generator 0x769
Parity:          even
Rates:           512 / 1200 / 2400 baud
Messages:        optional 7-bit ASCII alphanumeric
```

The capcode's low three bits select one of eight frames. Address and message codewords are BCH/parity encoded and unused positions are filled with idle codewords. Messages may extend into a second batch subject to the CC1111 255-byte packet limit.

TX fields include frequency, baud, deviation, capcode, function, optional alphanumeric message, polarity, repeat count, and RFCat offset.

Repeat handling is performed host-side because RFCat firmware repeat behavior is not relied upon. A repeat count of 0 transmits once; a repeat count of 4 performs five separate NIC_XMIT operations.

## RF configuration

Generic POCSAG uses 2-FSK with hardware sync disabled. Frequency, baud, and deviation are explicit.

The known-good POCSAG512 validation used a requested 4.5 kHz deviation. The CC1111 DEVIATN register is 0xDF11; correcting this mapping was required for the transmitted deviation to match the requested value closely enough for clean decoding.

## Polarity

Normal POCSAG sync is:

```text
0x7CD215D8
01111100110100100001010111011000
```

RFCat Web provides an explicit TX polarity inversion option. The receiver detects both normal and inverted streams automatically.

## Receiver

The Receiver panel includes a dedicated **POCSAG Receiver** preset with:

```text
Frequency: configurable
Baud:      512 / 1200 / 2400
```

Starting the preset configures the CC1111 for the validated receive path:

```text
Modulation:          2-FSK
Requested deviation: 4.5 kHz
Channel bandwidth:   93.75 kHz
Hardware sync:       disabled
Packet length:       fixed 255 bytes
CRC:                 off
Whitening:           off
Append status:       off
Address check:       none
```

The software decoder searches the received bitstream for POCSAG sync, detects normal or inverted polarity, validates BCH/parity codewords, corrects a single bad bit per codeword when possible, extracts capcode/function, and decodes 7-bit alphanumeric messages.

Because RFCat delivers fixed 255-byte receive buffers in the validated setup, the browser keeps a 1020-byte rolling POCSAG buffer. This allows a sync/page crossing an RFCat receive boundary to be decoded. Consecutive duplicate results rediscovered from that rolling window are suppressed.

### Known-good OTA RX test

A YARD Stick One receiver was validated with:

```text
Frequency:           467.750 MHz
Baud:                512
Modulation:          2-FSK
Requested deviation: 4.5 kHz
Channel bandwidth:   93.75 kHz
Hardware sync:       disabled
Packet length:       fixed 255 bytes
```

A live transmission decoded as capcode 1, function 3, message `hello`, inverted polarity, with zero corrected bits.

This validates the tested YARD Stick One/RFCat Web receive path. It is not a claim that every paging installation uses 467.750 MHz or these exact RF parameters.

## JTECH reference compatibility

The separate JTECH protocol reproduces the public reference script's fixed 664-bit streams for the two documented selections, 79984 and 79992. Those fixed patterns were independently captured and matched the expected waveform.

JTECH compatibility remains intentionally limited to those two published reference patterns. RFCat Web does not infer undocumented 40-bit fields or provide capcode scanning/enumeration.

## Validation

Automated coverage includes:

- POCSAG constants, BCH/parity, frame placement, and message encoding
- normal and inverted polarity
- 512/1200/2400 configuration validation
- alert-only and alphanumeric RX decoding
- single-bit RX correction
- rejection of unrelated bytes
- decoding a page spanning 255-byte receive chunks
- host-side repeat behavior
- fixed JTECH reference waveforms

POCSAG512 TX and RX have additionally been tested OTA with YARD Stick One hardware. Higher POCSAG rates remain implemented and synthetically covered but should be independently OTA-validated before being described as hardware validated.

## Scope

Use the transmitter only with paging equipment and frequencies you own or are explicitly authorized to test. The implementation requires an explicit capcode and does not include scanning, capcode enumeration, brute force, or mass-page workflows.
