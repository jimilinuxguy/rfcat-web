# RFCat Web

A browser-based WebUSB interface for controlling an RFCat-compatible CC1111 radio such as the YARD Stick One.

RFCat Web provides direct radio configuration, receive/transmit controls, register inspection, and a modular protocol system for generating and transmitting supported RF waveforms without requiring a native RFCat Python installation.

## Features

- WebUSB connection to RFCat-compatible CC1111 devices
- Tested with YARD Stick One (`VID 0x1d50`, `PID 0x605b`)
- Radio configuration and register readback
- Frequency, modulation, data-rate, bandwidth, deviation, sync, and packet configuration
- RX and TX modes
- Optional external amplifier control
- Register dump/debugging support
- Modular protocol/plugin architecture
- Protocol-specific controls generated dynamically by the UI
- Reusable PWM and Manchester encoders
- Node.js unit tests for protocol encoders
- Zero-build browser architecture suitable for GitHub Pages

## Supported Protocols

### Binary

Transmit an arbitrary binary waveform using the current radio configuration. Supports `0`/`1` symbol input, MSB-first packing, RFCat repeat count, and repeat offset.

### CAME 12-bit

CAME-style 12-bit OOK encoding using `0 -> 100` and `1 -> 110`, with a base timing of approximately 320 µs and approximately 3125 symbols/sec.

### LRS Pager

LRS pager packet generation for authorized testing. The implementation supports explicitly selected restaurant, pager, and alert values and configures the radio for 467.750 MHz, 2-FSK, 625 baud, Manchester encoding, and disabled sync.

### Tesla Charge Port

Tesla charge-port RF waveform generation for authorized interoperability testing with user-owned or otherwise authorized hardware. Supports 433.920 MHz, an optional 315 MHz test setting, ASK/OOK, 2500 baud, configurable repetitions, and explicit ASK/OOK PA configuration.

### Generic OOK/PWM

A configurable OOK PWM generator for protocol development and laboratory testing. Controls include frequency, symbol rate, logical bit string, HIGH/LOW duration for logical `0` and `1`, and repetitions.

### Oregon Scientific THGR122NX

Experimental Oregon Scientific THGR122NX weather-sensor waveform generation with channel, rolling ID, temperature, humidity, battery state, bit serialization, and Manchester encoding. This implementation should be considered experimental until validated against additional real receivers/captures.

### Acurite 5n1

Acurite 5n1 weather-station transmission has been validated over the air using a YARD Stick One and decoded successfully by `rtl_433` decoder 40.

Supported fields include channel A/B/C, sequence number, 12-bit sensor ID, battery state, raw wind value, temperature in °F, and relative humidity.

Example logical packet:

```text
C1 23 78 81 28 65 B2 1C
```

The validated example decodes as:

```text
model         Acurite-5n1
message_type  56
id            291
channel       A
sequence_num  0
Battery       1
wind_speed    9.3 km/h
temperature   72.5 F
humidity      50 %
Integrity     CHECKSUM
```

#### Acurite RF Encoding

Experimentally validated configuration:

```text
Frequency:          433.920 MHz
Modulation:         ASK/OOK
RF symbol rate:     ~9796 symbols/sec
Logical packet:     64 bits / 8 bytes
Frames per TX:      3
Inter-frame LOW:    20 RF symbols
Measured gap:       ~2.22 ms
```

Each frame begins with:

```text
111111000000
```

Data uses inverted RF PWM polarity relative to the logical packet:

```text
logical 0 -> 110000
logical 1 -> 111100
```

This polarity is intentional because the Acurite decoder in `rtl_433` inverts the received bitbuffer before interpreting the packet.

The OTA transmission was successfully decoded using:

```bash
rtl_433 -f 433.92M -R 40 -vvv
```

Analyzer validation:

```bash
rtl_433 -f 433.92M -A
```

produced three identical 64-bit frames:

```text
{64}c12378812865b21c
{64}c12378812865b21c
{64}c12378812865b21c
```

The native Acurite decoder subsequently reported all three frames with valid checksums.

## Architecture

The project uses native browser ES modules and does not require a bundler.

```text
rfcat-web/
├── index.html
├── app.js
├── styles.css
├── js/
│   ├── core/
│   │   └── bytes.js
│   ├── encoding/
│   │   ├── manchester.js
│   │   └── pwm.js
│   ├── protocols/
│   │   ├── index.js
│   │   ├── binary.js
│   │   ├── came12.js
│   │   ├── lrs.js
│   │   ├── tesla.js
│   │   ├── pwm.js
│   │   ├── oregon-thgr122nx.js
│   │   └── acurite-5n1.js
│   ├── radio/
│   │   └── registers.js
│   ├── rfcat/
│   │   ├── constants.js
│   │   └── device.js
│   └── ui/
│       ├── log.js
│       └── protocols.js
└── tests/
    ├── pwm.test.js
    ├── manchester.test.js
    ├── oregon-thgr122nx.test.js
    └── acurite-5n1.test.js
```

## Protocol Plugin Model

Protocol-specific behavior lives in individual modules under `js/protocols/`. The application itself does not need protocol-specific UI or encoding logic.

A protocol can declare `id`, `name`, `description`, `fields`, `encode()`, `configure()`, and `transmit()`.

The generic protocol UI renders fields dynamically from the protocol descriptor. Protocols are explicitly registered in `js/protocols/index.js`; this keeps the project compatible with native browser ES modules and a zero-build deployment.

## Hardware Abstraction

`js/rfcat/device.js` contains the RFCat/WebUSB hardware abstraction, including USB framing, RFCat command/response handling, CC1111 register access, radio modes, frequency, data rate, bandwidth, modulation, deviation, Manchester, sync, PA configuration, amplifier control, and packet transmission.

Protocol modules should use this abstraction rather than directly constructing USB commands.

## ASK/OOK PA Configuration

ASK/OOK protocols use explicit PA configuration. The YARD Stick One CC1111 PATABLE base address used by this project is:

```text
0xDF2D
```

The known-working ASK/OOK configuration uses:

```text
PATABLE[0] = 0xC0
FREND0     = 0x11
```

This is handled by the device-level `configureAskOokPa()` helper.

## RFCat USB Framing

Outbound RFCat command:

```text
APP | CMD | uint16LE(payload_length) | payload
```

Inbound RFCat response:

```text
0x40 | APP | CMD | uint16LE(payload_length) | payload
```

The YARD Stick One uses bulk endpoint 5 OUT and endpoint `0x85` IN.

## Development

The application must be served over HTTP/HTTPS rather than opened directly with `file://`.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a WebUSB-compatible browser. `localhost` is suitable for local WebUSB development.

## Tests

Install dependencies if required:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Tests cover reusable encoders and protocol-specific waveform construction, including the validated Acurite 5n1 framing and RF polarity.

## Acurite Validation Workflow

Analyze pulse timing:

```bash
rtl_433 -f 433.92M -A
```

A validated transmission produced approximately:

```text
short pulse:       ~228 µs
long pulse:        ~432 µs
sync pulse:        ~648 µs
inter-frame gap:   ~2224 µs
bit period:        ~612 µs
```

Decode with the actual Acurite decoder:

```bash
rtl_433 -f 433.92M -R 40 -vvv
```

Successful decoding with `Integrity: CHECKSUM` provides end-to-end validation beyond generic waveform analysis.

## RX Notes

When RFCat is placed into RX mode, avoid polling or peeking radio registers while actively receiving. Register traffic during RX has been observed to interfere with reception.

Lowball mode is therefore optional/manual rather than continuously manipulated while listening.

## TX Safety and Authorization

RF transmissions can affect nearby devices using the same frequencies and protocols. Use this project only with equipment and systems you own or are explicitly authorized to test. Observe applicable frequency, power, duty-cycle, and licensing requirements. Prefer low-power or shielded laboratory testing while developing protocol implementations.

## Browser Support

A browser with WebUSB support is required. Chromium-based browsers are the intended environment.

## Project Goals

RFCat Web is intended to make RFCat-style experimentation accessible directly from the browser while keeping hardware access isolated from protocol implementations, protocol implementations modular, waveform encoders reusable, UI generation generic, and protocol behavior independently testable.

The architecture is deliberately lightweight: plain HTML, CSS, JavaScript modules, WebUSB, and Node's built-in test runner.

## License

See the repository license for licensing terms.
