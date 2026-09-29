# RFCat Web Protocol Documentation

This directory contains implementation and validation notes for RFCat Web protocol modules.

## Protocol documentation

- [Schrader MRXGG4](protocols/schrader-mrxgg4.md) — TPMS implementation with OTA validation.
- [Schrader EG53MA4](protocols/schrader-eg53ma4.md) — TPMS implementation with OTA validation.
- [Schrader SMD3MA4 / 3039](protocols/schrader-smd3ma4.md) — shared Schrader/Subaru/Nissan-family wire format implementation.
- [Schrader MRXBC5A4](protocols/schrader-mrxbc5a4.md) — BMW-family TPMS implementation and synthetic validation tooling.
- [TouchTunes / The Fonz](protocols/touchtunes.md) — OTA waveform-validated 433.92 MHz ASK/OOK remote protocol implementation.

## Validation terminology

**Structural implementation** means the encoder was implemented from the available protocol/source description.

**Synthetic validation** means generated RF samples were independently inspected or decoded to verify packet construction and timing.

**OTA waveform validated** means the implementation was transmitted by the target RFCat hardware and independently captured with another receiver. The captured waveform was compared with the expected framing and timing.

**Receiver validated** should only be used when an intended real receiver/device has accepted the generated transmission.

These distinctions are intentional. OTA waveform validation demonstrates that the radio emitted the intended signal but does not, by itself, establish interoperability with every real receiver.

## Synthetic captures

Protocol-specific generators under `tools/` write disposable RF captures under `tmp/`. These captures are useful for regression analysis with tools such as rtl_433 without requiring repeated live transmissions.

## Adding a protocol

A protocol module should own its metadata, fields, validation, encoder, RF configuration, transmit behavior, and optional preview information. Add the module to the explicit registry in `js/protocols/index.js` and add tests and protocol documentation where appropriate.

Protocol-specific logic should not be added to `app.js` or the RFCat device abstraction.
