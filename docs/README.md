# RFCat Web Documentation

This directory contains implementation notes and protocol documentation for RFCat Web.

RFCat Web is a browser-based WebUSB controller for RFCat-compatible CC1111 hardware such as the YARD Stick One.

## Core documentation

### Receiver and protocol decoders

See:

```text
receiver-decoders.md
```

This document covers:

- Raw RX
- Auto decode mode
- Protocol-specific RX
- The `decode(bytes, context)` interface
- Unknown packet handling
- CC1111 RSSI/LQI appended status bytes
- Packet framing
- CAME-12 RX
- POCSAG RX and the dedicated receiver preset
- Rolling receive-buffer decoding
- Known-good OTA validation setups
- Decoder development

### RFCat USB

See:

```text
rfcat-usb.md
```

This document describes the browser/WebUSB side of RFCat communication, including RFCat application IDs, commands, USB framing, packet TX/RX, and radio state control.

### Radio configuration

See:

```text
radio.md
```

This document covers CC1111 radio configuration and the register-level behavior used by RFCat Web.

## Protocol documentation

Protocol-specific documentation lives under:

```text
protocols/
```

Current protocol documentation includes:

```text
protocols/acurite-5n1.md
protocols/came12.md
protocols/lrs.md
protocols/oregon-thgr122nx.md
protocols/pocsag.md
protocols/pwm.md
protocols/schrader-eg53ma4.md
protocols/schrader-mrxbc5a4.md
protocols/schrader-mrxgg4.md
protocols/schrader-smd3ma4.md
protocols/tesla.md
protocols/touchtunes.md
```

Other protocol implementations may exist in `js/protocols/` before a dedicated protocol document is added.

## Protocol architecture

Protocol modules live under:

```text
js/protocols/
```

The registry lives in:

```text
js/protocols/index.js
```

A protocol may provide:

```js
{
    id,
    name,
    description,
    fields,
    encode,
    configure,
    transmit,
    decode
}
```

Protocols only need to implement the operations they support.

## Packet transmit protocols

Normal transmit protocols encode their UI values into a packet:

```text
UI values
    ↓
encode()
    ↓
Uint8Array payload
    ↓
configure()
    ↓
transmit()
```

RFCat Web requires normal packet protocols to return a non-empty byte payload.

## Direct transmit protocols

Some RF operations do not naturally produce packet bytes.

These protocols can declare:

```js
txMode: "direct"
```

A direct protocol can still use `encode()` for validation and resolving its configuration, but the resulting `bytes` array may be empty.

The application then allows the protocol's `configure()` and `transmit()` methods to perform the operation directly.

Continuous Carrier is the first direct transmit protocol.

## Continuous Carrier

Continuous Carrier is an RF test protocol intended for short bench tests.

It configures:

```text
frequency
ASK/OOK modulation
maximum configured PA power
YARD Stick One amplifier
continuous TX mode
```

and automatically stops after a bounded duration.

The generic CC1111 continuous-TX primitive belongs in the RFCat device layer.

The decision to use that primitive, along with frequency and duration, belongs in the protocol layer.

This keeps the architecture:

```text
Continuous Carrier protocol
          ↓
RFCatUSB continuous-TX primitive
          ↓
RFCat firmware
          ↓
CC1111
```

rather than embedding Continuous Carrier behavior directly into `app.js` or the device layer.

The continuous-carrier RF waveform should be independently verified with an SDR, spectrum analyzer, or second receiver before treating the implementation as hardware validated.

## Receive protocols

Protocols can opt into receive decoding with:

```js
decode(bytes, context)
```

A decoder returns a result when the payload matches:

```js
{
    fields: {
        // decoded values
    },

    summary: "Human-readable result"
}
```

and returns:

```js
null
```

when the payload does not match.

This is important for Auto mode because several protocol decoders may inspect the same received packet.

## IPython export

The IPython exporter reuses protocol configuration rather than maintaining a separate set of RF presets.

A recorder-style device object records operations performed by:

```js
protocol.configure()
```

and converts them into RFCat/rflib-compatible Python commands.

This allows protocol defaults and user overrides to remain consistent between browser transmission and exported scripts.

Direct transmit protocols require special consideration because they may perform operations such as timed TX rather than a normal `RFxmit()` packet call.

## Adding a protocol

When adding a new protocol:

1. Add the implementation under `js/protocols/`.
2. Export the protocol using the same module convention as the existing protocols.
3. Register it in `js/protocols/index.js`.
4. Define UI fields in the protocol rather than `app.js`.
5. Implement `encode()` for TX if applicable.
6. Implement `configure()` for protocol-specific RF settings if applicable.
7. Implement `transmit()` for TX if applicable.
8. Implement `decode()` for RX if applicable.
9. Add tests.
10. Add protocol documentation when the protocol is sufficiently understood.

Keep generic CC1111 and RFCat operations in the device/radio layers.

Keep protocol-specific behavior in the protocol module.

## Validation

Documentation should distinguish between:

```text
implemented
synthetically validated
OTA waveform validated
device interoperability validated
```

These are not equivalent.

For example, matching an expected waveform on an SDR validates the transmitted waveform but does not prove interoperability with every physical target device.

Similarly, receiving an RFCat-generated CAME packet between two YARD Stick One devices validates the RFCat Web TX/RX path but does not prove that a physical asynchronous CAME remote will produce packet boundaries compatible with the CC1111 packet engine.

## Safety

Only transmit on frequencies and systems you are authorized to use.

RF test modes, including Continuous Carrier, should use short durations and an appropriate test environment to minimize interference.