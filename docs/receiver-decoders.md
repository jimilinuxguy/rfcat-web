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

Retekess T112, T119, TD157, TD161, TD164, TD165 and TD174 are available as protocol-specific RX decoders and participate in Auto mode. All seven implemented models have been validated over the air with YARD Stick One hardware for both TX and RX.

T112 and TD161 use dedicated timing-tolerant decoders. The T119/TD157/TD165/TD174 family uses a shared Princeton-style pulse decoder that searches across arbitrary byte alignment and rolling RFCat receive-buffer boundaries. It builds HIGH/LOW runs, suppresses short slicer glitches, anchors frames on the long LOW trailer, tolerates partial runs at repeated-frame boundaries, and accepts a final symbol whose LOW portion merges into the frame trailer.

### Raw OOK sampling

A key OTA finding is that the CC1111 raw receive sampling rate should not be confused with the protocol's transmit symbol timing. Sampling the Princeton-style formats at approximately one sample per TE was marginal: real captures could contain recognizable repeated traffic but short 1-TE pulses collapsed into phase-shifted `AA`/`55` or `11`/`22`/`44`/`88` patterns and the logical frame would not decode reliably.

The validated receiver therefore samples these protocols at four samples per TE:

| Model | RF | TX TE | Raw RX sample rate | RX scale |
| --- | --- | ---: | ---: | ---: |
| T119 | 433.920 MHz OOK | 271 µs | 14760.1476 samples/s | 4× |
| TD157 | 433.920 MHz OOK | 212 µs | 18867.9245 samples/s | 4× |
| TD165 | 433.920 MHz OOK | 271 µs | 14760.1476 samples/s | 4× |
| TD174 | 433.889 MHz OOK | 326 µs | 12269.9387 samples/s | 4× |

These presets use 93.750 kHz bandwidth, hardware sync disabled, Manchester disabled, fixed raw packets, CRC/whitening/status disabled, no address check, and lowball/raw OOK receive. The decoder scales its expected 1:3 and 3:1 pulse widths by the protocol's RX sample scale.

T112 remains validated with its dedicated 9090.909 samples/s raw preset, and TD161 remains validated at 5000 samples/s. TD164 is different from the OOK family: it uses 433.920 MHz 2-FSK at 10 kbit/s, 93.750 kHz bandwidth and a 15 kHz requested deviation in the current implementation.

### Decoder validation rules

TD174's OTA testing confirmed that its logical field order is **13-bit station, 2-bit action, 8-bit pager, trailing zero**. Treating it as the generic station/pager/action layout produced stable but incorrect pager values, so TD174 has an explicit action-before-pager mapping for both TX and RX.

TD164 searches for its fixed preamble and validates its separator, BCD pager digits, and both checksum nibbles before reporting a decoded frame. Raw 2-FSK receive buffers can still contain unrelated RF activity; protocol decode output is intentionally stricter than the raw capture stream.

All Retekess decoders have synthetic encode/decode regressions in addition to OTA validation. The four 4× OOK receivers also have oversampled waveform regressions so future shared-decoder changes do not silently return them to marginal one-sample-per-TE behavior.

Auto decoding is passive. A decoded capture does not cause retransmission.


## Offline capture import and RX analyzer

Receiver exports can be imported back into RFCat Web without a connected YARD Stick One. Use **Import JSON** in the Receiver and choose a previously exported RX JSON file. Each capture is reconstructed from its hex payload and passed through the same protocol decoder entry point used by live RX. Changing **Decode** or a grouped decoder's **Model** automatically re-runs all imported captures, so one capture set can be compared across decoders without re-importing it.

New exports include the capture frequency, data rate, and selected decode mode so offline analysis retains useful acquisition context. Older exports remain importable; when those fields are absent, the current radio-form values are used as decoder context.

The Receiver session statistics distinguish total RF/imported events from successfully decoded and rejected events. POCSAG duplicate suppression is counted separately. Strict protocol modes such as LRS can therefore count a false hardware-sync event as rejected without presenting it as a valid protocol capture.

Decoded capture cards also provide **Copy hex** and **Use for TX** actions. **Use for TX** selects the matching transmitter protocol and copies fields with matching IDs into its form; it never starts transmission automatically.

Offline re-decoding is intended for decoder development and regression work. It does not emulate the CC1111 packet engine, RF demodulation, hardware Manchester decoding, or hardware sync acquisition. Those stages still require OTA validation when their behavior matters.

### Validated offline workflow

The offline analyzer was validated with exported 13-byte LRS hardware-sync captures while no YARD Stick One was connected. Two imported frames (`AA FC 2D 01 00 01 00 00 00 00 00 01 2D`) were re-decoded as two valid LRS Pager events with zero rejected events, recovering restaurant 1, station 0, pager 1, alert 1, and checksum `2D`.


## Capture Compare

Select two or more Receiver captures with their **Compare** checkboxes, then choose **Compare (N)**. RFCat Web displays the captures side by side and highlights byte positions whose values differ. Byte positions are zero-based in the hover label.

When selected captures contain decoded fields, the comparison also builds a field table. Rows whose values differ between captures are highlighted, making protocol-level changes such as pager IDs, alert types, addresses, and checksums visible without manually comparing hex strings.

Capture Compare works with live and imported captures and requires no connected radio for offline analysis. Comparison is intentionally descriptive: it shows which bytes and decoded fields changed but does not assume that correlation proves a field's encoding. Repeated controlled captures can be used to establish those relationships during protocol research.


## Capture Sessions

Capture Sessions provide a persistent browser-local workspace for receiver research. Sessions are stored in IndexedDB and do not require a server or connected radio. A saved session includes its capture set, notes, selected decoder/model, capture filter, frequency, data rate, and timestamps.

Use **New** to start an empty workspace, **Save** to create or update the active session, **Open** to restore the selected saved session, **Rename** to change its name, and **Delete** to remove it from browser storage. The session status changes to **Modified** when captures or notes change after saving.

Opening a session reconstructs its stored capture bytes and runs them through the current decoder pipeline, so saved captures benefit from decoder improvements. Capture Compare, Copy hex, and Use for TX continue to work on restored sessions. Session data remains in the browser profile's IndexedDB until the user deletes the session or clears the site's browser storage. JSON export remains the portable backup/interchange format.
