# RFCat Web

Browser-based WebUSB controller for RFCat-compatible CC1111 hardware such as the YARD Stick One.

RFCat Web provides direct radio configuration, receive/transmit controls, waveform inspection, and a modular protocol system that keeps protocol-specific encoding and RF configuration out of the main application.

## Protocols

Implemented protocol modules include CAME-12, Binary, LRS, JTECH, Retekess T112/T119/TD157/TD161/TD164/TD165/TD174 restaurant pagers, Tesla charge-port test signaling, generic OOK/PWM, Oregon THGR122NX, Acurite 5n1, several Schrader TPMS formats, TouchTunes / The Fonz, Continuous Carrier, and generic POCSAG. POCSAG supports explicit-capcode alerts and 7-bit alphanumeric messages, 512/1200/2400 baud, configurable TX polarity, and receive decoding.

### Validation status

Protocol implementations have different validation levels. A synthetic validation means generated samples were checked against the expected decoder or source algorithm. OTA waveform validation additionally means a YARD Stick One transmission was independently captured and its timing/framing compared with the expected waveform.

POCSAG512 TX and RX are **OTA validated with YARD Stick One hardware**. LRS Pager TX and RX are also **OTA validated with YARD Stick One hardware** at 467.750 MHz / 625 baud. LRS RX uses CC1111 hardware Manchester decoding with `AA AA` hardware sync and validates the remaining 13-byte frame structure and checksum before surfacing a capture. TX was independently received/decoded after correcting the CC1111 deviation register mapping. RX was validated at 467.750 MHz / 512 baud with a live POCSAG transmission, including capcode, function, alphanumeric message, automatic polarity detection, and zero corrected bits in the known-good capture. The JTECH reference patterns were also independently captured and matched their expected fixed waveforms.

TouchTunes / The Fonz is **OTA waveform validated**. A YARD Stick One transmission captured with an RTL-SDR matched the expected preamble, 32-bit frame structure, variable-length OOK encoding, and approximately 566 µs base timing. Receiver interoperability with an actual TouchTunes jukebox has not been validated.

## Receiver and decoders

The receiver supports **Raw**, **Auto**, and protocol-specific decode modes. Protocol modules can opt into RX by implementing a `decode(bytes, context)` hook. Unknown traffic remains available as raw captures, and CC1111 appended RSSI/LQI status bytes are separated from the protocol payload before decoding.

CAME-12, POCSAG, and LRS Pager provide protocol-specific RX decoders. CAME-12 has been validated over the air between two YARD Stick One devices using compatible CC1111 packet framing. POCSAG512 RX is OTA validated at 467.750 MHz / 512 baud with automatic normal/inverted polarity detection, BCH/parity validation, single-bit correction, alphanumeric decoding, and a rolling receive buffer that spans 255-byte RFCat receive boundaries. The current generic receiver remains packet-engine based, so physical asynchronous OOK remotes may require pulse-oriented capture rather than the same packet boundaries used by RFCat-generated transmissions.

See [Receiver and Protocol Decoders](docs/receiver-decoders.md) for RX behavior, decoder development, framing notes, and the known-good CAME and POCSAG test setups.

The Retekess modules support explicit single-pager operation and sequential paging within a configured system/station. Protocol-defined all-pager commands are exposed where documented by the source material. **Retekess T112, T119, TD157, TD161, TD164, TD165 and TD174 TX/RX are OTA validated with YARD Stick One hardware.** T112 was additionally checked against independent RTL-SDR/rtl_433 captures for system 0, pagers 69 and 70. The asynchronous Princeton-style receivers use protocol-specific raw OOK sampling rates; T119, TD157, TD165 and TD174 use 4× sampling so the CC1111 preserves short 1-TE pulses reliably. TD174 uses the verified station → action → pager field order. TD164 uses 2-FSK and only reports frames that match its preamble and checksum rules.

See [docs/README.md](docs/README.md) for protocol documentation.

## Architecture

Protocol implementations live under `js/protocols/`. Each protocol declares its own metadata, UI fields, encoder, radio configuration, and transmit behavior. `app.js` remains protocol-agnostic and the WebUSB/RFCat device layer remains hardware-focused.

Browser ES modules use explicit relative imports with `.js` extensions. The protocol registry is maintained explicitly in `js/protocols/index.js`, which keeps the project compatible with GitHub Pages without requiring a bundler.

## Running locally

Serve the repository from a local HTTP server:

```bash
python3 -m http.server 8080
```

Then open the local server in a WebUSB-capable browser.

## Testing

Run the JavaScript test suite with the project's npm test command.

Synthetic RF generators under `tools/` can create sample files for independent waveform/decoder analysis. Generated captures should be written under `tmp/`, which is excluded from version control.

## Safety and authorization

Transmit only on frequencies and equipment you are legally permitted to use. Protocol support is intended for development, interoperability testing, research, and equipment you own or are explicitly authorized to test.

## OOK Pulse Analyzer

The receiver includes an OOK Pulse Analyzer for inspecting HIGH/LOW timing runs from raw RFCat receive buffers. It uses the configured data rate as the sampling clock, draws a timing waveform, clusters similar pulse widths, estimates a base pulse, and can export the captured runs and timing distribution as JSON.

For asynchronous OOK exploration, disable sync and enable **Lowball / raw OOK receive** before listening. The analyzer currently derives pulse timing from received CC1111 sample bytes; it is not a firmware-level edge timestamp capture, so timing resolution is limited by the configured data rate.
