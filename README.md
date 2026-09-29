# RFCat Web

Browser-based WebUSB controller for RFCat-compatible CC1111 hardware such as the YARD Stick One.

RFCat Web provides direct radio configuration, receive/transmit controls, waveform inspection, and a modular protocol system that keeps protocol-specific encoding and RF configuration out of the main application.

## Protocols

Implemented protocol modules include CAME-12, Binary, LRS, Tesla charge-port test signaling, generic OOK/PWM, Oregon THGR122NX, Acurite 5n1, several Schrader TPMS formats, and TouchTunes / The Fonz.

### Validation status

Protocol implementations have different validation levels. A synthetic validation means generated samples were checked against the expected decoder or source algorithm. OTA waveform validation additionally means a YARD Stick One transmission was independently captured and its timing/framing compared with the expected waveform.

TouchTunes / The Fonz is **OTA waveform validated**. A YARD Stick One transmission captured with an RTL-SDR matched the expected preamble, 32-bit frame structure, variable-length OOK encoding, and approximately 566 µs base timing. Receiver interoperability with an actual TouchTunes jukebox has not been validated.

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
