# Receiver and Protocol Decoders

RFCat Web can feed received RFCat buffers through protocol-specific decoders while preserving the original bytes for inspection and export.

## Receiver modes

The **Decode** selector controls how a received buffer is interpreted:

- **Raw** — do not run a protocol decoder. Display the received bytes as-is.
- **Auto** — try each registered protocol that implements `decode(bytes, context)` and use the first successful result.
- **Specific protocol** — run only the selected protocol decoder.

The **Show** selector filters the capture list without discarding captures:

- **All** — decoded and unknown captures.
- **Decoded only** — captures accepted by a decoder.
- **Unknown only** — captures that were not decoded successfully.

**Export JSON** exports the capture session, including raw bytes and decoded metadata when available.

## RFCat packet framing matters

The current RX path consumes RFCat/CC1111 packet-engine receive buffers. The receiver's packet configuration therefore has to be compatible with the transmitted data before a decoder can see a complete buffer.

For example, the current RFCat Web CAME-12 transmitter produces 22 bytes with its default three-burst configuration. During two-YARD-Stick testing, an RX configured for a fixed 255-byte packet did not deliver a completed packet. Setting the receiver's fixed packet length to 22 allowed the CAME decoder to receive and identify the transmission.

This distinction is important: successful decoding of an RFCat-generated waveform does not imply that an arbitrary physical remote will arrive with the same CC1111 packet boundaries. Asynchronous OOK remotes may require a pulse-oriented/raw RF receive path rather than ordinary packet-engine framing.

## Append RSSI/LQI status

When CC1111 append-status is enabled, the final two bytes returned by the packet engine are status metadata rather than protocol payload. RFCat Web separates these bytes before calling protocol decoders.

The extracted metadata includes RSSI, LQI, and the CRC-valid flag. The original capture metadata is retained for display/export while the protocol decoder receives only the payload bytes.

## Decoder contract

A protocol opts into RX decoding by implementing `decode(bytes, context)` in its descriptor:

```javascript
const protocol = {
    id: "example",
    name: "Example",

    decode(bytes, context) {
        // Return null when this buffer is not this protocol.
        if (!looksLikeExample(bytes)) return null;

        return {
            summary: "Device 0x1234",
            fields: {
                deviceId: "0x1234",
            },
        };
    },
};
```

A decoder should return `null` for a normal non-match. Throw an error only when the selected protocol received malformed input that should be surfaced to the user.

`bytes` must be treated as a `Uint8Array`. `context` is reserved for receive metadata/configuration that can help protocol-specific decoding.

## Auto decoding

Auto mode only considers registered protocols whose descriptor has a `decode` function. Decoders should therefore be conservative. A weak signature can cause a protocol to claim unrelated traffic before a later decoder gets a chance to inspect it.

Prefer validating framing, fixed markers, checksums, symbol patterns, or other protocol invariants before returning a decoded result.

## CAME-12 decoder

CAME-12 was the first protocol decoder implemented in RFCat Web. Its waveform maps each logical bit to three OOK symbols:

```text
0 -> 100
1 -> 110
```

The decoder searches possible bit alignments in the received byte stream, validates 12 consecutive CAME symbols, and returns the recovered binary and hexadecimal code.

Example result:

```text
Protocol: CAME 12-bit
Code:     101001011010
Hex:      0xA5A
```

### Known-good two-YARD-Stick test

For a controlled RFCat Web TX-to-RX test, configure the receiving radio to match the transmitter and set the fixed packet length to the number of bytes produced by the TX configuration. With the default CAME-12 settings used during validation (three bursts), this is 22 bytes.

Start with **Raw / All** to verify reception, then select **CAME 12-bit** or **Auto** to verify decoding.

## POCSAG decoder

POCSAG RX is decoded from a rolling byte window rather than treating every RFCat receive event as an independent page. This is necessary because the validated configuration returns fixed 255-byte buffers while a POCSAG page may cross that boundary.

The dedicated **POCSAG Receiver** preset accepts frequency and 512/1200/2400 baud and configures the known-good receive parameters automatically. The validated 512-baud setup uses 2-FSK, 4.5 kHz requested deviation, 93.75 kHz channel bandwidth, hardware sync disabled, fixed 255-byte packets, CRC/whitening/status disabled, and no address check.

The decoder searches for the standard POCSAG sync word, detects normal or inverted polarity, validates BCH/parity, attempts single-bit codeword correction, extracts capcode/function, and decodes 7-bit alphanumeric messages. The rolling window is limited to 1020 bytes, and consecutive duplicate pages rediscovered from the window are suppressed.

### Known-good POCSAG OTA test

A live YARD Stick One receive test at **467.750 MHz / 512 baud** decoded capcode 1, function 3, message `hello`, inverted polarity, with zero corrected bits.

This frequency is a documented test configuration, not a universal POCSAG frequency.

## Adding another decoder

1. Add a pure decoder helper to the protocol module where practical.
2. Add `decode(bytes, context)` to the protocol descriptor.
3. Return `null` for non-matching traffic.
4. Validate enough protocol structure to minimize false positives in Auto mode.
5. Add known-answer tests under `tests/`.
6. Test status-byte stripping separately if append-status is relevant.
7. Document what kind of RX input has actually been validated: synthetic bytes, RFCat-to-RFCat OTA, independent OTA capture, or a real physical transmitter.

Do not put protocol-specific decoding logic in `app.js` or the RFCat device layer.


## Retekess pager RX

Retekess T112, T119, TD157, TD161, TD164, TD165 and TD174 are available as passive protocol-specific RX decoders and participate in Auto mode. The decoders recover the documented addressing/action fields from source-derived framing. TD164 additionally validates its checksum nibbles.

The current Retekess RX implementations are synthetically validated against their corresponding TX encoders. OTA validation is still required. For hardware validation, capture a known base-station page, retain the raw bytes/pulse data, record the exact pager model/revision and configured identifiers, and compare the decoded fields and measured timing with the source-derived protocol documentation.

Auto decoding is passive. A decoded capture does not cause retransmission.
