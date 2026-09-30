# RFCat Web Developer Guide

This document describes the internal architecture of RFCat Web and the conventions used when adding radio features, protocols, encoders, decoders, and export functionality.

RFCat Web is intentionally implemented as a lightweight browser application using plain JavaScript, browser ES modules, and WebUSB.

There is no required bundler.

## Project structure

The important project areas are approximately:

```text
.
├── app.js
├── index.html
├── styles.css
├── README.md
├── DEVELOPER.md
│
├── js/
│   ├── export/
│   │   └── ipython.js
│   │
│   ├── protocols/
│   │   ├── index.js
│   │   ├── came12.js
│   │   ├── continuous-carrier.js
│   │   └── ...
│   │
│   ├── radio/
│   │   └── registers.js
│   │
│   ├── rfcat/
│   │   ├── constants.js
│   │   └── device.js
│   │
│   └── rx/
│       └── decode.js
│
├── docs/
│   ├── README.md
│   ├── radio.md
│   ├── receiver-decoders.md
│   ├── rfcat-usb.md
│   └── protocols/
│
├── tests/
└── tools/
```

## Architecture

The major layers are:

```text
Browser UI
    ↓
app.js
    ↓
Protocol layer
    ↓
RFCatUSB / radio layer
    ↓
WebUSB
    ↓
RFCat firmware
    ↓
CC1111
```

Each layer should have a clear responsibility.

## `app.js`

`app.js` owns application-level behavior.

Examples include:

```text
device connection
device disconnection
UI events
protocol selection
protocol field rendering
RX start/stop
capture rendering
TX dispatch
IPython export dialog
logging
```

Protocol-specific encoding and RF configuration should generally not be added directly to `app.js`.

If a behavior only applies to one RF protocol or RF test mode, it probably belongs in a protocol module.

## RFCat device layer

Generic RFCat/WebUSB operations belong under:

```text
js/rfcat/
```

`device.js` owns hardware-level operations such as:

```text
RFCat USB commands
peek/poke
radio mode
frequency configuration
packet TX
packet RX
PA configuration
amplifier control
radio configuration reads
continuous TX primitives
```

The device layer should know how to perform a generic CC1111 operation.

It should not know why a particular protocol needs that operation.

For example:

```js
d.startContinuousCarrier()
```

can be a device primitive.

But concepts such as:

```text
433.920 MHz carrier
5-second duration
bench-test UI
```

belong in the Continuous Carrier protocol.

## Radio layer

CC1111 register definitions and register-oriented helpers live under:

```text
js/radio/
```

For example:

```js
R.MDMCFG2
R.PKTCTRL0
R.PKTCTRL1
R.PKTLEN
R.FREND0
R.PATABLE
R.RSSI
R.LQI
R.MARCSTATE
```

Use named register constants instead of repeating raw addresses when a constant already exists.

Prefer:

```js
await d.peek(R.MDMCFG2, 1);
```

over:

```js
await d.peek(0xdf0e, 1);
```

when possible.

## Protocol layer

Protocol modules live under:

```text
js/protocols/
```

The protocol registry is:

```text
js/protocols/index.js
```

The registry is explicit rather than dynamically discovered because RFCat Web is designed to run directly in the browser without a bundler.

Use explicit `.js` extensions in imports.

For example:

```js
import came12 from "./came12.js";
import continuousCarrier from "./continuous-carrier.js";
```

## Protocol object

A protocol object can contain:

```js
const protocol = {
    id: "example",
    name: "Example",

    description: "Example protocol",

    fields: [],

    encode(values) {
        // ...
    },

    async configure(d, values) {
        // ...
    },

    async transmit(d, encoded, values) {
        // ...
    },

    decode(bytes, context) {
        // ...
    },
};

export default protocol;
```

Not every protocol needs every operation.

## Protocol module exports

The current registry uses default imports.

A protocol should therefore normally end with:

```js
export default protocol;
```

and be imported with:

```js
import protocol from "./protocol.js";
```

Do not mix:

```js
export const protocol = ...
```

with:

```js
import protocol from "./protocol.js";
```

because the latter expects a default export.

## Protocol fields

Protocols define their own UI fields.

For example:

```js
fields: [
    {
        id: "frequency",
        label: "Frequency",
        type: "number",
        default: 433.92,
        min: 300,
        max: 928,
        step: 0.001,
        suffix: "MHz",
    },
]
```

This allows `app.js` to construct the protocol UI without knowing the protocol.

Protocol-specific defaults should live in the protocol definition.

## Packet transmit protocol flow

Normal packet protocols use:

```text
values
    ↓
protocol.encode(values)
    ↓
encoded.bytes
    ↓
protocol.configure(device, values)
    ↓
protocol.transmit(device, encoded, values)
```

A packet protocol's `encode()` result should contain:

```js
{
    bytes: Uint8Array
}
```

It may also contain metadata such as:

```js
{
    bytes,
    summary,
    repeats,
    symbols,
    fields
}
```

The application requires normal packet protocols to produce a non-empty `Uint8Array`.

## Direct transmit protocols

Some RF operations do not produce a normal packet.

Examples include RF test modes where the radio is placed directly into a transmit state.

These protocols declare:

```js
txMode: "direct"
```

The TX dispatcher must not require a non-empty packet payload for these protocols.

A direct protocol can still implement `encode()` so the existing protocol pipeline can:

```text
validate fields
normalize values
create a summary
provide metadata to transmit()
```

For example:

```js
encode(values) {
    return {
        bytes: new Uint8Array(0),
        frequency: Number(values.frequency),
        duration: Number(values.duration),
    };
}
```

The empty payload is intentional for a direct protocol.

## TX dispatcher

The application TX path should preserve strict validation for normal protocols:

```js
const encoded = await protocol.encode(values);

if (protocol.txMode !== "direct") {
    if (!(encoded?.bytes instanceof Uint8Array)) {
        throw new Error(
            `${protocol.name} did not return a Uint8Array`
        );
    }

    if (!encoded.bytes.length) {
        throw new Error(
            `${protocol.name} generated an empty payload`
        );
    }
}
```

Then configuration and transmission are dispatched normally:

```js
if (protocol.configure) {
    await protocol.configure(d, values);
}

const result = await protocol.transmit(
    d,
    encoded,
    values,
);
```

Do not call `configure()` twice.

For normal packet protocols the application can log:

```text
TX N bytes: ...
```

For direct protocols it should use the returned protocol summary instead of assuming packet bytes exist.

## Continuous Carrier

Continuous Carrier is the first direct TX protocol.

It lives under:

```text
js/protocols/continuous-carrier.js
```

It should declare:

```js
txMode: "direct"
```

The protocol owns:

```text
frequency
duration
modulation selection
power configuration
amplifier selection
decision to start continuous TX
```

The device layer owns only the generic operation required to place the CC1111 into the appropriate continuous TX state.

### Carrier flow

The intended flow is:

```text
Continuous Carrier fields
        ↓
encode()
        ↓
validate + normalize
        ↓
configure()
        ↓
frequency
ASK/OOK
maximum PA
amplifier
        ↓
transmit()
        ↓
startContinuousCarrier()
        ↓
bounded delay
        ↓
stopContinuousCarrier()
```

The duration should remain bounded.

A `finally` block should be used so the radio is returned to IDLE and the amplifier is disabled even if transmission fails.

For example:

```js
try {
    await d.startContinuousCarrier();

    await new Promise((resolve) =>
        setTimeout(resolve, duration * 1000)
    );
} finally {
    await d.stopContinuousCarrier();
}
```

### Experimental status

Do not assume that entering a CC1111 continuous/random TX mode necessarily produces an ideal unmodulated CW waveform.

The resulting RF output should be independently checked with:

```text
SDR
spectrum analyzer
RF power meter
second receiver
```

before describing the carrier implementation as hardware validated.

## Receiver architecture

RX is packet-engine based.

The high-level path is:

```text
CC1111 RX
    ↓
RFCat NIC_RECV
    ↓
WebUSB
    ↓
RFCat Web
    ↓
status-byte separation
    ↓
protocol decoder
    ↓
capture UI
```

The receiver supports:

```text
Raw
Auto
protocol-specific
```

decode modes.

## Raw mode

Raw mode does not require a protocol decoder.

Received bytes remain visible for inspection.

This mode is useful when:

```text
developing a decoder
checking packet framing
checking packet length
inspecting unknown traffic
testing radio configuration
```

## Protocol decoder API

A protocol opts into RX by implementing:

```js
decode(bytes, context)
```

The decoder should return:

```js
null
```

when the payload does not match.

When it does match, return a result such as:

```js
{
    fields: {
        code: "...",
    },

    summary: "Decoded result",
}
```

Additional protocol-specific metadata may also be returned.

## Auto decoding

Auto mode attempts available protocol decoders against the received payload.

Because multiple decoders may inspect the same packet, decoders should be conservative about claiming a match.

A decoder should not throw simply because arbitrary RF data does not match its protocol.

It should normally return:

```js
null
```

## Unknown packets

Packets that fail all decoders remain available as raw captures.

Do not discard unknown RF traffic merely because it does not currently match a supported protocol.

The UI supports filtering captures by:

```text
All
Decoded
Unknown
```

## CC1111 appended status

The CC1111 can append two status bytes to a received packet.

These contain packet RSSI and LQI/CRC information.

These bytes are transport/radio metadata and are not part of the protocol payload.

The RX pipeline should remove them before calling:

```js
protocol.decode()
```

when appended status is enabled.

The metadata can then be displayed separately in the capture UI.

## Packet framing

A major limitation of the current receiver is that it uses the CC1111 packet engine.

This means radio packet configuration affects whether bytes are ever delivered to RFCat Web.

Important settings include:

```text
sync mode
packet mode
packet length
CRC
whitening
address checking
append status
```

A correct decoder cannot decode bytes that the CC1111 never emits as a completed packet.

## CAME-12 RX validation

CAME-12 has been validated between two YARD Stick One devices.

The tested TX generated:

```text
22 bytes
```

with an example transmission:

```text
D3 49 A6 D3 40 00 00 00
1A 69 34 DA 68 00 00 00
03 4D 26 9B 4D 00
```

A known-good receiver setup used approximately:

```text
Frequency:      433.919678 MHz
Modulation:     ASK/OOK
Data rate:      1780 baud
Bandwidth:      93.750 kHz
Sync:           None
Packet mode:    Fixed
Packet length:  22
CRC:            Off
Whitening:      Off
Address check:  None
Append status:  Off
```

A fixed packet length of 255 did not work for the 22-byte test transmission because the CC1111 continued waiting for the remainder of the configured packet.

Changing the fixed RX packet length to 22 allowed the transmission to reach the RFCat Web decoder.

This distinction is important when debugging RX.

## Physical asynchronous OOK devices

Successful RX between two RFCat devices does not necessarily prove compatibility with a physical OOK remote.

An RFCat-generated transmission can be deliberately arranged into CC1111 packet boundaries.

A physical remote may instead emit a timing-oriented asynchronous waveform without a convenient packet boundary.

Supporting those devices may require a future pulse-oriented OOK receiver.

That path would conceptually be:

```text
RF samples / transitions
       ↓
pulse timing extraction
       ↓
pulse normalization
       ↓
protocol pulse decoder
```

rather than relying entirely on `NIC_RECV` packet boundaries.

## CAME-12 decoder

The CAME-12 decoder searches the received bit stream for the protocol's 3-bit symbols.

The currently supported symbols are:

```text
0 → 100
1 → 110
```

The decoder searches multiple bit offsets because an RX buffer is not guaranteed to begin on the first protocol symbol.

A valid 12-symbol sequence is converted back into the CAME code and hexadecimal representation.

## Adding a decoder

When adding RX support to a protocol:

1. Determine the actual received packet representation.
2. Do not assume TX encoder boundaries equal RX boundaries.
3. Implement `decode(bytes, context)`.
4. Return `null` for non-matching traffic.
5. Add known-good synthetic tests.
6. Test Auto mode.
7. Test protocol-specific mode.
8. Test unknown traffic.
9. Validate with hardware when possible.
10. Document the required radio framing.

## IPython export

RFCat Web can export protocol configurations to RFCat/rflib-style IPython commands.

The exporter lives under:

```text
js/export/
```

The design intentionally reuses protocol configuration.

Rather than duplicate every protocol's RF settings in the exporter, a recorder object implements the relevant device API.

The protocol's existing:

```js
protocol.configure()
```

runs against that recorder.

The recorder converts the requested operations into Python statements.

This keeps browser TX configuration and exported RFCat configuration synchronized.

## Export values

Export should use the resolved protocol values.

That includes:

```text
field defaults
select defaults
user-entered overrides
protocol-specific settings
```

The exporter should not silently substitute unrelated global radio settings when the selected protocol defines its own values.

## Export without hardware

IPython export should not require a connected YARD Stick One.

No physical radio operation is necessary because the recorder captures the requested configuration instead of sending USB commands.

## Direct protocols and export

A direct protocol may intentionally produce:

```js
bytes: new Uint8Array(0)
```

The export path therefore must not reject an empty payload when:

```js
protocol.txMode === "direct"
```

Normal packet protocols should continue to require a non-empty payload.

Timed or stateful direct operations may require additional exporter support to produce appropriate Python such as:

```python
d.setModeTX()
time.sleep(5)
d.setModeIDLE()
```

Do not fabricate packet data simply to make a direct operation look like a normal `RFxmit()` call.

## Device connection

RFCat Web uses WebUSB.

Application code should check that the device is open before hardware operations:

```js
if (!d.device?.opened) {
    throw new Error(
        "RFCat device is not connected"
    );
}
```

Export-only operations are an exception because they can operate against a recorder rather than physical hardware.

## Radio state

Important RFCat radio states include:

```js
C.RF_RX
C.RF_TX
C.RF_IDLE
```

Use the named constants rather than unexplained numeric values.

Prefer:

```js
await d.mode(C.RF_IDLE);
```

over:

```js
await d.mode(0);
```

unless the numeric value is explicitly required by the firmware API and documented.

## Disconnect handling

When USB disconnects:

```text
stop application monitoring
clear running state
clear the device reference
update connected UI state
clear local timers
clear local TX state
```

Do not attempt to send an RF command to hardware after the USB device has already disconnected.

For a timed direct TX operation, clear any local timer/state during disconnect handling.

## Error handling

Protocol operations should throw useful errors.

Application-level event handlers should catch them and report them through the normal log.

For example:

```js
try {
    // operation
} catch (e) {
    log(`Protocol TX error: ${e.message}`);
}
```

Avoid silently swallowing errors except for explicitly best-effort cleanup.

## Cleanup

Hardware state cleanup should generally use `finally`.

For example:

```js
try {
    await d.startContinuousCarrier();

    // operation
} finally {
    await d.stopContinuousCarrier();
}
```

This is especially important for TX operations.

## Testing

Run:

```bash
npm test
```

Tests should cover protocol behavior without requiring RF hardware whenever practical.

Useful test categories include:

```text
encoder tests
decoder tests
round-trip tests
known vectors
IPython export tests
direct-protocol validation
RX dispatch tests
unknown packet tests
```

Hardware validation should be documented separately because a unit test cannot prove RF behavior.

## Test vectors

Prefer deterministic known vectors.

For example, a CAME encoder/decoder test can:

```text
encode known 12-bit value
        ↓
decode resulting bytes
        ↓
compare recovered value
```

When decoder alignment matters, include tests where the protocol does not begin at bit offset zero.

## RF validation

There are several useful validation levels.

### Synthetic

The encoder or decoder agrees with expected software-generated vectors.

### Internal round trip

RFCat Web can encode a value and its decoder can recover that value.

### OTA between RFCat devices

One YARD Stick transmits and another receives.

This validates substantially more of the RF path but may still depend on deliberately compatible packet framing.

### Independent waveform capture

An SDR or analyzer independently observes the waveform.

This is particularly useful for validating:

```text
frequency
modulation
symbol timing
preamble
framing
continuous carrier behavior
```

### Target interoperability

The actual intended physical device successfully interoperates.

This is the strongest validation for a protocol integration.

Documentation should state which level has actually been achieved.

## Coding style

Keep the project lightweight.

Prefer:

```text
plain JavaScript
browser APIs
small focused modules
explicit imports
protocol-owned behavior
```

Avoid introducing framework dependencies for functionality that can be implemented cleanly with the existing architecture.

Use readable names.

Prefer comments that explain why hardware configuration is necessary rather than comments that simply repeat the code.

## Adding a new TX protocol

A typical packet TX protocol should:

1. Create `js/protocols/<name>.js`.
2. Define metadata.
3. Define protocol UI fields.
4. Implement `encode(values)`.
5. Return a non-empty `Uint8Array`.
6. Implement `configure(d, values)` when custom RF settings are required.
7. Implement `transmit(d, encoded, values)`.
8. Export the protocol as default.
9. Register it in `js/protocols/index.js`.
10. Add tests.
11. Add documentation.

## Adding a direct TX protocol

A direct TX protocol should:

1. Create the protocol module.
2. Set:

   ```js
   txMode: "direct"
   ```

3. Define its UI fields.
4. Implement `encode()` for validation/normalization if required by the application pipeline.
5. Do not manufacture fake packet bytes.
6. Implement protocol-specific `configure()`.
7. Use generic device primitives from `device.js`.
8. Implement cleanup with `finally`.
9. Keep the operation bounded where appropriate.
10. Add tests and documentation.

## Adding a new device primitive

Before adding a method to `RFCatUSB`, ask:

> Is this a generic RFCat/CC1111 operation, or is it specific to one protocol?

Generic operations belong in `device.js`.

Examples:

```text
enter RX
enter TX
enter IDLE
read register
write register
set frequency
set amplifier
start continuous TX
```

Protocol-specific concepts belong in `js/protocols/`.

Examples:

```text
CAME code
Tesla charge-port command
Oregon sensor packet
five-second 433.92 MHz carrier test
```

This separation prevents the hardware layer from becoming a collection of protocol-specific shortcuts.

## Documentation

Update documentation when behavior changes.

At minimum, consider:

```text
README.md
DEVELOPER.md
docs/README.md
relevant docs/protocols/*.md
receiver-decoders.md
radio.md
rfcat-usb.md
```

Document known limitations and validation status.

Do not describe experimental RF behavior as validated until it has actually been measured.

## Safety and authorization

RFCat Web can directly control RF transmit hardware.

Only transmit on frequencies, power levels, equipment, and systems you are authorized to use.

Keep RF test transmissions, especially continuous-carrier tests, short and controlled.

When testing two radios on a bench, avoid placing the transmitter directly against the receiving antenna because very strong nearby signals can overload the receiver.

An SDR or spectrum analyzer is preferable when validating exact RF output characteristics.