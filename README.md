# RFCat Web

Browser-native control of the **YARD Stick One / CC1111** using the
WebUSB API.

RFCat Web provides a lightweight browser interface for configuring the
CC1111 radio, receiving RF data, transmitting protocol-generated
payloads, and experimenting with RF protocols without requiring the
native Python RFCat client.

The application is written as standard browser JavaScript modules and
does not require a build system.

> **Important:** Transmit only on frequencies, devices, and systems that
> you own or are explicitly authorized to test. RF regulations vary by
> jurisdiction.

## Features

### WebUSB RFCat Interface

-   Connect directly to a YARD Stick One from the browser
-   RFCat USB framing
-   Register reads and writes
-   Radio mode control
-   RX event handling
-   RF transmission
-   External amplifier control
-   Multi-transfer USB writes for larger RFCat commands

### Radio Configuration

The UI supports frequency, modulation, data rate, channel bandwidth,
sync word/mode, packet length, CRC, whitening, address checking, device
address, RSSI/LQI status bytes, and lowball/raw OOK receive mode.

Supported modulation selections include ASK/OOK, 2-FSK, GFSK, 4-FSK, and
MSK.

### Receiver

The receiver provides live RFCat receive events, raw packet display,
RSSI, LQI, CRC status, packet/byte counters, receiver state, and
clearable packet history.

### Protocol Transmitter

Transmit protocols are implemented as independent JavaScript modules.
The UI is generated automatically from each protocol's field
definitions.

Current modules:

-   Binary OOK
-   CAME 12-bit
-   LRS Pager
-   Tesla Charge Port

Protocol-specific controls and transmission logic no longer live in
`app.js` or `index.html`.

## Browser Requirements

RFCat Web requires the WebUSB API. Google Chrome, Microsoft Edge, and
other Chromium-based browsers with WebUSB support are recommended.

WebUSB generally requires a secure context: HTTPS or `http://localhost`.

## Running Locally

Because RFCat Web uses JavaScript ES modules, serve the project through
a local HTTP server instead of opening `index.html` directly.

``` bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`, connect the YARD Stick One, and click
**Connect YS1**.

## Project Structure

``` text
rfcat-web/
├── index.html
├── app.js
├── styles.css
├── js/
│   ├── core/
│   │   └── bytes.js
│   ├── radio/
│   │   ├── registers.js
│   │   └── presets.js
│   ├── rfcat/
│   │   ├── constants.js
│   │   └── device.js
│   ├── protocols/
│   │   ├── index.js
│   │   ├── binary.js
│   │   ├── came12.js
│   │   ├── lrs.js
│   │   └── tesla.js
│   └── ui/
│       ├── log.js
│       └── protocols.js
└── tests/
```

## Architecture

RFCat Web separates the application into four major layers:

``` text
Browser UI
    │
    ▼
Protocol Registry
    │
    ▼
Protocol Modules
    │
    ▼
RFCatUSB / CC1111
```

`app.js` handles device connection, generic radio configuration,
receiver operation, protocol selection, generic protocol execution, UI
state, and activity logging. It does not need to know how CAME, LRS,
Tesla, or future protocols are encoded.

## Protocol Plugin Architecture

Protocols are registered in `js/protocols/index.js`:

``` js
import binary from "./binary.js";
import came12 from "./came12.js";
import lrs from "./lrs.js";
import tesla from "./tesla.js";

export const protocols = Object.freeze([
    binary,
    came12,
    lrs,
    tesla,
]);

export function getProtocol(id) {
    return protocols.find((protocol) => protocol.id === id) ?? null;
}
```

Each protocol exports a descriptor containing its metadata and behavior:

``` js
const protocol = {
    id: "example",
    name: "Example Protocol",
    description: "Description of the protocol.",
    fields: [],
    encode(values) {
        // Generate Uint8Array
    },
    async configure(device, values) {
        // Configure radio if required
    },
    async transmit(device, encoded, values) {
        // Perform transmission
    },
};

export default protocol;
```

Adding another protocol normally requires creating a module in
`js/protocols/` and registering it in `js/protocols/index.js`. No
protocol-specific HTML is required.

## Dynamic Protocol UI

Protocol fields are rendered by `js/ui/protocols.js`. Supported field
types include text, number, select, textarea, and checkbox.

Field IDs are namespaced by protocol. Values are returned to the
protocol as a plain object.

## Generic Protocol Execution

The main application follows the same execution sequence regardless of
protocol:

``` text
Select protocol
      │
      ▼
Read generated UI fields
      │
      ▼
protocol.encode()
      │
      ▼
protocol.configure()
      │
      ▼
protocol.transmit()
```

The encoder must return a `Uint8Array` in `encoded.bytes`. The
application validates that the encoder produced a non-empty
`Uint8Array`.

Hardware and RFCat-specific payload limits are enforced by the device
layer rather than the UI layer.

## RFCatUSB

The hardware abstraction is implemented in `js/rfcat/device.js`.

`RFCatUSB` provides methods for connecting through WebUSB, reading RFCat
responses, sending commands, register reads/writes, radio mode changes,
frequency/data-rate/bandwidth/modulation/deviation configuration,
Manchester encoding, sync and packet configuration, PA configuration,
amplifier control, RF transmission, register dumps, and lowball mode.

Protocol modules should use this interface rather than interacting with
WebUSB directly.

## RFCat USB Protocol

Outbound commands use:

``` text
APP
CMD
LEN_LO
LEN_HI
PAYLOAD...
```

Equivalent structure:

``` text
app + cmd + uint16LE(payload_length) + payload
```

Inbound RFCat responses begin with:

``` text
0x40
APP
CMD
LEN_LO
LEN_HI
PAYLOAD...
```

Important IDs:

``` text
APP_SYSTEM = 0xFF
APP_NIC    = 0x42

SYS_PEEK    = 0x80
SYS_POKE    = 0x81
SYS_PING    = 0x82
SYS_RFMODE  = 0x88
SYS_PARTNUM = 0x8E

NIC_RECV         = 0x01
NIC_XMIT         = 0x02
NIC_SET_AMP_MODE = 0x0A

RF_RX   = 0x02
RF_TX   = 0x03
RF_IDLE = 0x04
```

## USB Transfers

RFCat commands may be larger than a single USB transfer. RFCat Web
divides the framed command into 64-byte USB writes. These chunks are
transport fragments, not separate RF transmissions.

For example, a 210-byte RF payload produces a 216-byte `NIC_XMIT`
payload:

``` text
2 bytes data length
2 bytes repeat
2 bytes offset
210 bytes RF data
-----------------
216 bytes
```

## Transmission Format

RFCat `NIC_XMIT` receives:

``` text
uint16LE(data_length)
uint16LE(repeat)
uint16LE(offset)
data...
```

RFCat Web constructs this with:

``` js
concat(
    u16(data.length),
    u16(repeat),
    u16(offset),
    data,
)
```

## TX Payload Validation

RFCat-specific transmission validation lives in `RFCatUSB.transmit()`.

The device layer verifies that the payload is a `Uint8Array`, is not
empty, and does not exceed the current 255-byte RFCat Web TX limit.

``` js
transmit(data, repeat = 0, offset = 0) {
    if (!(data instanceof Uint8Array)) {
        throw new TypeError("RFCat TX data must be a Uint8Array");
    }

    if (data.length === 0) {
        throw new Error("RFCat TX payload cannot be empty");
    }

    if (data.length > 255) {
        throw new RangeError(
            `RFCat TX payload cannot exceed 255 bytes ` +
            `(received ${data.length})`
        );
    }

    return this.send(
        C.APP_NIC,
        C.NIC_XMIT,
        concat(u16(data.length), u16(repeat), u16(offset), data),
        10000,
    );
}
```

Keeping this constraint in the device layer ensures every caller
receives the same validation.

## CC1111 Register Map

Radio register addresses are centralized in `js/radio/registers.js`.

A particularly important correction discovered during development is:

``` js
PATABLE: 0xdf2d
```

not `0xDF2E`.

An incorrect PATABLE address caused ASK/OOK transmission behavior that
appeared as a continuously keyed carrier.

## Receiver

Received RFCat frames are delivered through `APP_NIC / NIC_RECV`.

When sync is disabled, received buffers should be considered raw RFCat
receive buffers rather than guaranteed protocol packet boundaries.

### Important RX Rule

Once the radio has entered `RF_RX`, RFCat Web avoids polling radio
registers while actively listening. Repeated register reads during RX
were observed to interfere with reliable reception.

## Lowball Mode

RFCat's lowball behavior is useful for raw OOK reception. The known
register changes reproduced by the WebUSB implementation are:

``` text
DF00: 0C -> AA
DF01: 4E -> AA
DF02: 00 -> FA
DF03: 40 -> 00
DF0E: 30 -> 34
DF38: 1F -> 00
DF3A: B5 -> C5
```

Lowball is intended primarily for receiving raw OOK data and is not
automatically enabled for protocol transmission.

## Power Amplifier Configuration

PA configuration is modulation-dependent. ASK/OOK and FSK should not be
assumed to use identical PATABLE layouts.

### ASK/OOK PA Configuration

The known-good ASK/OOK configuration used by the Tesla module is:

``` text
PATABLE[0] = 0xC0
FREND0     = 0x11
```

RFCat Web provides a dedicated helper:

``` js
async configureAskOokPa() {
    const pa = new Uint8Array([
        0xc0, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
    ]);

    await this.poke(R.PATABLE, pa);

    let frend0 = (await this.peek(R.FREND0, 1))[0];
    frend0 = (frend0 & 0xf8) | 0x01;

    await this.poke(
        R.FREND0,
        new Uint8Array([frend0]),
    );
}
```

Protocols that require this configuration should call it explicitly:

``` js
await device.configureAskOokPa();
```

Do not make required hardware configuration optional with `?.()`,
because a missing method would then be silently ignored.

## External Amplifier

The YARD Stick One amplifier is controlled through
`APP_NIC / NIC_SET_AMP_MODE`, with `1` for enabled and `0` for disabled.

Protocol transmitters that enable the amplifier should use `try/finally`
so the amplifier is disabled even if transmission throws an exception.

## Binary OOK

The Binary module accepts a stream containing `0` and `1`. Whitespace is
ignored.

The bitstream is packed MSB-first into bytes. If the number of symbols
is not divisible by eight, zero bits are appended to the end.

Binary mode uses the current radio configuration rather than forcing a
protocol-specific RF configuration.

## CAME 12-bit

The CAME module implements the experimental 12-bit waveform encoder
currently used by the project.

The current symbol mapping is:

``` text
0 -> 100
1 -> 110
```

For the current 3125-symbol/s configuration, `T ≈ 320 µs`.

A typical transmission uses:

``` text
Frequency:   433.920 MHz
Modulation:  ASK/OOK
Data rate:   3125
Sync:        disabled
Manchester:  disabled
Bursts:      3
Gap:         31 T
```

Example code:

``` text
101001011010
```

Validated three-burst output:

``` text
D3 49 A6 D3 40 00 00 00
1A 69 34 DA 68 00 00 00
03 4D 26 9B 4D 00
```

Total: 176 symbols / 22 bytes.

The CAME encoder remains experimental and is intentionally isolated from
the hardware layer so it can be unit tested independently.

## LRS Pager

The LRS module generates the pager packet format implemented by the
project.

Radio configuration:

``` text
Frequency:   467.750 MHz
Modulation:  2-FSK
Data rate:   625
Deviation:   ~15 kHz
Sync mode:   disabled
Manchester:  enabled
```

The requested 15 kHz deviation resolves on the CC1111 to approximately
14.648 kHz.

Packet structure:

``` text
PREAMBLE
SYNC
RESTAURANT ID
STATION ID
PAGER ID
ZERO FIELD
ALERT
CHECKSUM
```

Constants:

``` text
Preamble:   AA AA AA
Sync:       FC 2D
Station ID: 0
```

Checksum:

``` text
sum(all packet bytes before checksum) % 255
```

Example with Restaurant ID 1, Pager ID 1, Alert 1:

``` text
AA AA AA FC 2D 01 00 01
00 00 00 00 00 01 2D
```

Total: 15 bytes.

This output has been verified over the air using Universal Radio Hacker.

## Tesla Charge Port

The Tesla module implements the fixed ASK/OOK waveform used by the
project's charge-port test transmitter.

Use only with a vehicle or RF test setup you own or are explicitly
authorized to test.

Source-derived radio configuration:

``` text
Frequency:   433.920 MHz
Modulation:  ASK/OOK
Data rate:   2500
```

The UI also provides a 315 MHz selection for experimentation with
authorized hardware. The 315 MHz option is not derived from the original
433.920 MHz implementation.

The fixed frame is 42 bytes:

``` text
15 55 55 51 59 4C B5 55
52 D5 4B 4A D3 4C AB 4B
15 94 CB 33 33 2D 54 B4
56 9A 65 5A 48 AC C6 59
99 99 69 A5 B2 B4 D4 2A
D2 80
```

Default frame count: 5.

``` text
42 bytes × 5 frames = 210 bytes
```

The frame-count UI is currently limited to 1--6 because `42 × 6 = 252`
bytes, remaining below the current 255-byte TX limit.

### Tesla ASK/OOK PA Requirement

Tesla transmission requires:

``` text
PATABLE[0] = 0xC0
FREND0     = 0x11
```

The protocol explicitly calls:

``` js
await device.configureAskOokPa();
```

During development, making this call optional allowed transmission to
continue even when the method did not exist. The USB payload remained
correct, but the RF capture appeared as an effectively continuous ASK
carrier.

Making the PA configuration mandatory restored proper OOK modulation.

### Tesla OTA Verification

Tesla transmission has been verified over the air using Universal Radio
Hacker and an RTL-SDR receiver.

Test configuration:

``` text
Frequency:          433.920 MHz
Sample rate:        1.0 MS/s
Modulation:         ASK
Samples per symbol: 400
Bits per symbol:    1
```

At a 1 MHz sample rate:

``` text
1,000,000 / 400 = 2500 symbols/second
```

which matches the configured Tesla transmission rate.

The transmitted frame begins:

``` text
15 55 55 51 ...
```

or:

``` text
00010101 01010101 01010101 01010001 ...
```

A captured URH region contained 332 bits from the expected 336-bit frame
and began three bits into the expected frame. After alignment, the
overlapping captured bits matched the expected transmitted bitstream.
URH also detected the inter-frame pause.

This verifies the structured 2500-symbol/s ASK/OOK waveform over the
air.

## SDR / Universal Radio Hacker

Universal Radio Hacker is useful for validating generated RF waveforms
independently of RFCat Web.

It can inspect ASK/OOK transitions, FSK transitions, symbol timing,
packet repetition, inter-frame gaps, Manchester encoding, raw
bitstreams, and OTA agreement with generated payloads.

When comparing a capture against generated bytes, remember that SDR
demodulators may begin or end a decoded region partway through a symbol
or frame.

## Radio Register Dumps

RFCat Web can dump the CC1111 radio register block beginning at
`0xDF00`.

Comparing native RFCat and WebUSB register dumps proved useful for
identifying differences in frequency, modulation, data rate, PA
configuration, calibration, packet settings, and radio state.

This process identified the PATABLE addressing issue and ASK/OOK PA
requirements.

## Known Startup Issue

An intermittent connection issue has been observed during the initial
RFCat ping:

``` text
USB OUT app=0xff cmd=0x82 ...
Timeout waiting for ff:82
USB read transfer error
Device disconnected
```

A subsequent reconnect generally succeeds.

This appears separate from radio configuration and protocol transmission
and remains an area for future investigation.

## Development Guidelines

### Keep Protocol Logic Out of `app.js`

Protocol-specific behavior belongs in `js/protocols/<protocol>.js`, not
in protocol-name `if/else` chains in the main application.

### Keep Hardware Logic Out of Protocol Encoders

Pure encoders should not directly access WebUSB, CC1111 registers, or
RFCat command framing. An encoder should primarily transform protocol
values into bytes.

### Keep Device Constraints in the Device Layer

Hardware and RFCat-specific constraints belong in `js/rfcat/device.js`,
including TX payload size, register access, RFCat framing, USB transfer
behavior, and radio modes.

### Use `try/finally` for Temporary Hardware State

When enabling the external amplifier:

``` js
await device.setAmpMode(true);

try {
    await device.transmit(encoded.bytes, 0, 0);
} finally {
    await device.mode(C.RF_IDLE);
    await device.setAmpMode(false);
}
```

### Do Not Silently Skip Required Hardware Configuration

Avoid:

``` js
await device.configureAskOokPa?.();
```

Prefer:

``` js
await device.configureAskOokPa();
```

A missing required method should produce an obvious error instead of an
incorrect RF transmission.

## Adding a Protocol

Create `js/protocols/example.js`:

``` js
function encodeExample(values) {
    return {
        bytes: new Uint8Array([
            0xaa,
            0xbb,
            0xcc,
        ]),
    };
}

const example = {
    id: "example",
    name: "Example",
    description: "Example protocol module.",

    fields: [
        {
            id: "repeats",
            label: "Repeats",
            type: "number",
            min: 1,
            max: 10,
            value: 1,
        },
    ],

    encode(values) {
        const encoded = encodeExample(values);

        return {
            ...encoded,
            summary: `Example TX: ${encoded.bytes.length} bytes`,
        };
    },

    async configure(device) {
        await device.mode(0x04);
    },

    async transmit(device, encoded, values) {
        await device.transmit(encoded.bytes, 0, 0);
    },
};

export default example;
```

Then register it in `js/protocols/index.js`.

The protocol will appear automatically in the Protocol Transmitter
selector.

## Testing

Pure protocol encoders should be tested independently from RF hardware.

Useful tests include known input → known bytes, invalid input rejection,
boundary values, padding behavior, repeat behavior, checksums, and frame
lengths.

Hardware validation should additionally verify radio register
configuration, RFCat command construction, USB framing, actual OTA
waveform, symbol rate, modulation, repetition, and inter-frame timing.

## Current Validation Status

  Protocol      Status   Notes
  ------------- -------- -------------------------------------------------
  Binary OOK    ✓        40-symbol / 5-byte test passed
  CAME 12-bit   ✓        3 bursts, 176 symbols, 22 bytes
  LRS Pager     ✓        Known packet verified OTA
  Tesla         ✓        433.920 MHz, 2500-symbol/s ASK/OOK verified OTA

## Current Architecture Status

The original protocol-specific transmitter implementation has been
replaced by the registry-driven architecture.

`index.html` contains only a generic protocol selector:

``` html
<select id="protocol"></select>
<div id="protocol-fields"></div>
<button id="protocol-transmit">
    Transmit
</button>
```

Protocol-specific controls are generated dynamically.

`app.js` imports the registry rather than individual encoders:

``` js
import {
    protocols,
    getProtocol,
} from "./js/protocols/index.js";
```

Future protocol additions should not require modifications to the main
transmitter UI or a growing protocol-specific `if/else` chain.

## Future Work

-   Move generic protocol execution into a dedicated protocol runner
-   Improve initial WebUSB ping/reconnect behavior
-   Expand automated protocol encoder tests
-   Add protocol preview hooks
-   Add dynamic field dependencies
-   Improve protocol-specific validation
-   Add optional protocol metadata display
-   Improve SDR comparison tooling
-   Further isolate radio configuration from UI state
-   Remove remaining protocol-specific presets that are no longer needed
-   Document additional CC1111 register behavior as it is validated

## Security and Safety

RFCat Web provides direct control over RF hardware.

Use it only:

-   On hardware you own
-   On systems you are authorized to test
-   On frequencies where your transmission is permitted
-   At appropriate power levels
-   In compliance with applicable RF regulations

Do not use the project to interfere with third-party devices,
communications, access-control systems, vehicles, paging systems, or
other RF infrastructure.

## License

Use the license included with the repository. If no license has been
added yet, add one before distributing or accepting external
contributions.

## Status

RFCat Web currently provides a working browser-native RFCat
implementation for the YARD Stick One with:

-   WebUSB connectivity
-   CC1111 radio configuration
-   Raw receive support
-   Lowball/raw OOK reception
-   RF transmission
-   External amplifier control
-   Registry-driven protocol modules
-   Dynamically generated protocol UI
-   Binary OOK generation
-   Experimental CAME 12-bit generation
-   LRS pager packet generation
-   Tesla charge-port waveform generation
-   Device-layer TX validation
-   Register dump/debugging tools
-   SDR-verified RF output

The protocol/plugin boundary is now established so additional RF formats
can be implemented without expanding the core application.
