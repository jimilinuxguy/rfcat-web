# RFCat Web

Browser-based WebUSB controller for RFCat-compatible CC1111 hardware such as the YARD Stick One.

RFCat Web provides direct radio configuration, receive/transmit controls, protocol-aware decoding, waveform inspection, IPython export, and a modular protocol system that keeps protocol-specific encoding and RF configuration out of the main application.

## Screenshots

### Radio configuration

Configure the CC1111 radio directly from the browser.

![RFCat Web radio configuration](docs/images/radio-configuration.png)

### Receiver and protocol transmitter

Receive raw or decoded RF traffic and transmit supported protocols.

![RFCat Web receiver and protocol transmitter](docs/images/receiver-transmitter.png)

### RF waveform preview

Inspect encoded RF symbols, packet data, symbol timing, and the generated waveform before transmission.

![RFCat Web RF waveform preview](docs/images/waveform-preview.png)

## Features

RFCat Web currently supports:

- Direct WebUSB communication with RFCat-compatible CC1111 devices
- Radio configuration and register inspection
- Packet receive and transmit
- Raw, Auto, and protocol-specific RX decoding
- Protocol-specific transmit configuration
- IPython / RFCat command export
- CC1111 RSSI, LQI, CRC, and MARCSTATE inspection
- Lowball/raw OOK receive configuration
- JSON RX capture export
- Modular protocol encoders and decoders
- Direct/non-packet transmit operations
- Bounded continuous-carrier RF testing
- Browser operation without a build system or bundler

## Protocols

Protocol implementations live under:

```text
js/protocols/
```

Implemented protocol modules include CAME-12, Binary, LRS, Tesla charge-port test signaling, generic OOK/PWM, Oregon THGR122NX, Acurite 5n1, several Schrader TPMS formats, TouchTunes / The Fonz, and Continuous Carrier RF test mode.

Each protocol owns its protocol-specific behavior rather than placing protocol logic in `app.js`.

A protocol can define:

```text
metadata
UI fields
encode()
configure()
transmit()
decode()
```

Not every protocol needs every operation.

Packet protocols normally generate a byte payload with `encode()` and transmit that payload through RFCat.

Direct protocols use:

```js
txMode: "direct"
```

for operations that do not naturally produce a packet payload. Continuous Carrier is the first direct protocol.

## Validation status

Protocol implementations have different validation levels.

A synthetic validation means generated samples were checked against the expected decoder or source algorithm.

OTA waveform validation means a YARD Stick One transmission was independently captured and its timing/framing compared with the expected waveform.

TouchTunes / The Fonz is **OTA waveform validated**. A YARD Stick One transmission captured with an RTL-SDR matched the expected preamble, 32-bit frame structure, variable-length OOK encoding, and approximately 566 µs base timing.

Receiver interoperability with an actual TouchTunes jukebox has not been validated.

CAME-12 TX/RX has also been validated between two YARD Stick One devices using compatible CC1111 packet framing.

## Receiver and decoders

The receiver supports:

```text
Raw
Auto
Protocol-specific
```

decode modes.

Protocol modules can opt into RX by implementing:

```js
decode(bytes, context)
```

A decoder returns a decoded result when the packet matches or `null` when it does not.

Unknown traffic remains available as raw captures.

When CC1111 appended packet status is enabled, RFCat Web separates the appended RSSI/LQI bytes from the protocol payload before passing the packet to protocol decoders.

Receiver captures can be filtered by:

```text
All
Decoded
Unknown
```

and exported as JSON.

### CAME-12 RX

CAME-12 is the first protocol with a protocol-aware RX decoder.

It has been validated over the air between two YARD Stick One devices.

A known-good controlled test uses approximately:

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

The important packet-engine detail is the packet length.

The tested CAME transmission generated 22 bytes. Configuring the receiver for a fixed 255-byte packet caused the CC1111 packet engine to wait for data that never arrived. Configuring the receiver for the actual 22-byte transmission allowed the packet to reach the decoder successfully.

This validates the path:

```text
YARD Stick TX
    ↓
433.92 MHz OOK
    ↓
YARD Stick RX
    ↓
WebUSB / NIC_RECV
    ↓
RFCat Web RX pipeline
    ↓
CAME-12 decoder
    ↓
Decoded UI result
```

The current receiver is packet-engine based.

A physical asynchronous OOK remote may not provide packet boundaries that match RFCat-generated traffic. Supporting those devices may require a future pulse-oriented asynchronous OOK receive path.

See:

```text
docs/receiver-decoders.md
```

for receiver behavior, decoder development, packet framing, and the known-good CAME test setup.

## Transmitter

The protocol transmitter dynamically builds its UI from the selected protocol's field definitions.

Normal packet protocols follow approximately:

```text
values
  ↓
encode()
  ↓
packet bytes
  ↓
configure()
  ↓
transmit()
```

The application validates that normal packet protocols return a non-empty `Uint8Array`.

Direct protocols follow:

```text
values
  ↓
encode / validate
  ↓
configure()
  ↓
direct transmit operation
```

and do not require packet bytes.

This allows RF operations that do not map naturally to `NIC_XMIT` packet transmission while preserving the same protocol architecture.

## Continuous Carrier

Continuous Carrier is implemented as a direct protocol.

It is intended for short-duration RF bench testing such as:

- Receiver RSSI testing
- Antenna testing
- RF path verification
- SDR inspection
- Spectrum analyzer testing

The protocol exposes frequency and duration as protocol fields.

Durations are intentionally bounded to short intervals.

The protocol performs approximately:

```text
Validate frequency/duration
        ↓
Set frequency
        ↓
Configure ASK/OOK
        ↓
Set maximum configured PA power
        ↓
Enable YARD Stick One amplifier
        ↓
Enter continuous TX mode
        ↓
Wait for bounded duration
        ↓
Return radio to IDLE
        ↓
Disable amplifier
```

Continuous Carrier is marked:

```js
txMode: "direct"
```

because it does not generate a normal packet payload.

The CC1111 continuous-transmit implementation should be considered experimental until the exact output has been independently verified with a second receiver, SDR, or spectrum analyzer.

## IPython export

RFCat Web can export the currently selected protocol configuration as RFCat/rflib-compatible IPython commands.

The exporter uses the same protocol configuration logic as normal transmission through a recorder-style device implementation.

This avoids maintaining a second independent copy of protocol radio configuration.

The export can include operations such as:

```text
frequency
modulation
data rate
deviation
sync configuration
Manchester encoding
PA configuration
amplifier state
encoded payload
repeat count
TX offset
```

The selected protocol's resolved field values are used, including default/dropdown values and user overrides.

Export does not require an attached RFCat device because the recorder captures the operations instead of sending them to hardware.

Direct protocols can also participate in export, although operations such as timed continuous TX may require protocol-specific export handling.

## Architecture

The project intentionally uses plain browser JavaScript and ES modules.

There is no React dependency and no bundler requirement.

The main architecture is:

```text
UI / app.js
     ↓
Protocol layer
     ↓
RFCatUSB device layer
     ↓
WebUSB
     ↓
RFCat firmware
     ↓
CC1111 radio
```

### Application layer

`app.js` owns application behavior such as:

- Connecting/disconnecting devices
- Building protocol UI
- Starting/stopping RX
- Rendering captures
- Selecting protocols
- Dispatching protocol TX
- Opening IPython export
- Logging

It should remain as protocol-agnostic as practical.

### Protocol layer

Protocol implementations live under:

```text
js/protocols/
```

Protocols own protocol-specific:

- Fields
- Validation
- Encoding
- Radio configuration
- Transmission
- Decoding

The registry is maintained explicitly in:

```text
js/protocols/index.js
```

Browser ES modules use explicit relative imports with `.js` extensions.

This keeps RFCat Web compatible with static hosting such as GitHub Pages without requiring a build step.

### Device layer

The RFCat/WebUSB implementation lives under:

```text
js/rfcat/
```

The device layer owns generic hardware operations such as:

- USB commands
- Register reads/writes
- Radio state changes
- Frequency configuration
- PA configuration
- RFCat packet TX/RX
- Amplifier control
- Generic continuous TX primitives

It should not contain knowledge of specific RF protocols.

For example, the device may know how to enter continuous TX mode, but the Continuous Carrier protocol decides when and why that operation is used.

### Radio layer

CC1111 register definitions and radio helpers live under:

```text
js/radio/
```

This includes register addresses such as:

```text
FREQ2
MDMCFG4
MDMCFG3
MDMCFG2
DEVIATN
PKTCTRL0
PKTCTRL1
PKTLEN
PATABLE
FREND0
RSSI
LQI
MARCSTATE
```

## Running locally

Serve the repository from a local HTTP server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

in a WebUSB-capable browser.

WebUSB generally requires a secure context. `localhost` is treated specially by browsers and can normally be used for local development.

## Testing

Install dependencies if necessary and run:

```bash
npm test
```

The test suite covers protocol encoders, receiver decoders, and export behavior.

Synthetic RF generators under:

```text
tools/
```

can create samples for independent waveform or decoder analysis.

Generated captures should be written under:

```text
tmp/
```

which is excluded from version control.

## Documentation

Additional documentation is under:

```text
docs/
```

Start with:

```text
docs/README.md
```

Receiver architecture:

```text
docs/receiver-decoders.md
```

RFCat/WebUSB implementation:

```text
docs/rfcat-usb.md
```

CC1111 radio configuration:

```text
docs/radio.md
```

Individual protocol notes are under:

```text
docs/protocols/
```

## Safety and authorization

Transmit only on frequencies, power levels, equipment, and systems you are legally permitted to use.

Protocol support and RF test functions are intended for development, interoperability testing, research, bench testing, and equipment you own or are explicitly authorized to test.

Continuous-carrier transmissions should be kept short and used in an appropriate RF test environment to avoid unnecessary interference.