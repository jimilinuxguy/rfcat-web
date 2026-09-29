# RFCat Web Developer Guide

This document describes the internal architecture of RFCat Web and how
to extend it.

## Architecture

RFCat Web is split into four primary layers:

``` text
UI
 ↓
Protocol modules / reusable encoders
 ↓
RFCat device abstraction
 ↓
WebUSB / YARD Stick One / CC1111
```

`app.js` coordinates the application but should not contain
protocol-specific encoding logic.

## Project Layout

``` text
rfcat-web/
├── README.md
├── DEVELOPER.md
├── index.html
├── app.js
├── styles.css
├── js/
│   ├── core/
│   │   └── bytes.js
│   ├── encoding/
│   │   ├── manchester.js
│   │   ├── pwm.js
│   │   └── waveform.js
│   ├── protocols/
│   │   ├── index.js
│   │   ├── binary.js
│   │   ├── came12.js
│   │   ├── lrs.js
│   │   ├── tesla.js
│   │   ├── pwm.js
│   │   ├── oregon-thgr122nx.js
│   │   ├── acurite-5n1.js
│   │   ├── schrader-mrxgg4.js
│   │   └── schrader-eg53ma4.js
│   ├── radio/
│   │   └── registers.js
│   ├── rfcat/
│   │   ├── constants.js
│   │   └── device.js
│   └── ui/
│       ├── log.js
│       ├── protocols.js
│       └── waveform.js
├── docs/
│   ├── README.md
│   ├── rfcat-usb.md
│   ├── radio.md
│   └── protocols/
├── tests/
└── tools/
```

## ES Modules

The application uses native browser ES modules. Always include `.js`
extensions and use paths relative to the importing module. For GitHub
Pages project sites, avoid root-relative imports because `/` refers to
the domain root rather than necessarily the repository root.

## Protocol Registry

Protocols are explicitly registered in `js/protocols/index.js`. A
zero-build browser application cannot enumerate an ES-module directory
at runtime, so the small explicit registry is intentional.

## Protocol Descriptor

A protocol module can provide:

``` javascript
const protocol = {
    id: "example",
    name: "Example",
    description: "Example protocol",
    fields: [],
    encode(values) {},
    async configure(device, values) {},
    async transmit(device, encoded, values) {},
};

export default protocol;
```

Named exports should be used for independently testable packet builders,
checksums, framing helpers, and waveform encoders.

## Dynamic Protocol UI

`js/ui/protocols.js` renders fields declared by the selected protocol.
Supported field concepts include text, number, checkbox, textarea, and
select.

The renderer should remain generic. Protocol-specific DOM should
normally not be added to `index.html`.

For identifiers naturally represented by RF tooling in hexadecimal,
prefer a text field and explicit hex parsing rather than forcing the
user to translate between decimal UI values and hex decoder output. Both
Schrader TPMS plugins follow this convention for sensor IDs and flags.

## Encoding and Waveform Layers

Reusable waveform algorithms belong in `js/encoding/`. Current examples
include `pwm.js`, `manchester.js`, and `waveform.js`.

`waveform.js` provides common waveform packing, CC1111 data-rate
quantization, timing analysis, run analysis, and byte-to-bit helpers.
Protocol modules should reuse these helpers where appropriate while
keeping protocol-specific framing, checksums, and unusual termination
behavior in the protocol module.

The UI waveform preview is diagnostic. A protocol may keep the preview
limited to meaningful protocol symbols while transmitting additional
termination symbols. EG53MA4 is an example: the validated protocol frame
is 240 Manchester half-symbols, while TX appends an explicit LOW reset
tail so the OTA decoder terminates at exactly 120 logical bits.

## Device Layer

`js/rfcat/device.js` owns WebUSB/RFCat framing, register access, RF
modes, frequency, data rate, bandwidth, modulation, deviation,
Manchester and sync configuration, packet configuration, PA
configuration, external amplifier control, and transmission.

The device layer should not know protocol names.

## Transmission

The generic application flow is:

``` text
Select protocol
      ↓
Read generated UI values
      ↓
protocol.encode(values)
      ↓
protocol.configure(device, values)
      ↓
protocol.transmit(device, encoded, values)
```

Protocol transmit functions should clean up temporary radio state,
particularly the external amplifier:

``` javascript
await device.setAmpMode(true);
try {
    await device.transmit(encoded.bytes, 0, 0);
} finally {
    await device.mode(0x04);
    await device.setAmpMode(false);
}
```

## ASK/OOK PA

ASK/OOK protocols use the dedicated device helper rather than generic
maximum-power configuration.

Known-working state:

``` text
PATABLE base = 0xDF2D
PATABLE[0]   = 0xC0
FREND0       = 0x11
```

An earlier off-by-one PATABLE address produced an incorrect nearly
continuous carrier, so keep the register definition centralized.

## RX Rule

After entering active RX mode, avoid register polling or peeking until
RX is stopped. Register access while listening has been observed to
disturb reception.

## Adding a Protocol

1.  Create `js/protocols/<protocol>.js`.
2.  Keep packet construction independent where practical.
3.  Export testable helpers as named exports.
4.  Add the default protocol descriptor and declarative UI fields.
5.  Register it in `js/protocols/index.js`.
6.  Add unit tests under `tests/`.
7.  Add protocol documentation under `docs/protocols/`.
8.  Generate a synthetic sample and validate against an independent
    decoder when practical.
9.  Only then perform controlled OTA validation on owned/authorized
    hardware.

## Testing Strategy

Prefer several levels of verification:

``` text
Known-answer unit test
        ↓
Generated packet inspection
        ↓
Generated waveform inspection
        ↓
Synthetic IQ / independent decoder
        ↓
SDR pulse measurement
        ↓
Independent OTA decoder
        ↓
Real receiver, when appropriate
```

The Schrader work demonstrates why each layer matters. MRXGG4 was first
validated synthetically against `rtl_433` before OTA transmission.
EG53MA4 likewise passed synthetic decoder #95 validation; OTA testing
then exposed a trailing packet-termination artifact even though the
first 120 decoded bits were correct. An explicit LOW reset tail fixed
the 121-bit decode and produced a clean 120-bit checksum-valid OTA
frame.

## GitHub Pages Debugging

If the HTML loads but the application does not initialize, check
DevTools for the first module error, JavaScript `404`s, missing `.js`
extensions, incorrect relative paths or filename capitalization, and
missing named exports.

## Documentation Policy

Keep the root `README.md` concise.

Use:

-   `README.md` for project overview and quick start.
-   `DEVELOPER.md` for architecture and extension instructions.
-   `docs/README.md` as the documentation index.
-   `docs/protocols/*.md` for protocol research, packet layouts, RF
    timing, test vectors, and validation notes.
