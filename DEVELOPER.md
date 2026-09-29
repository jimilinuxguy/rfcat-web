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
├── docs/
│   ├── README.md
│   ├── rfcat-usb.md
│   ├── radio.md
│   └── protocols/
└── tests/
```

## ES Modules

The application uses native browser ES modules.

`index.html` should load the application with:

``` html
<script type="module" src="./app.js"></script>
```

Always include `.js` extensions:

``` javascript
import { getProtocol } from "./js/protocols/index.js";
```

Within a nested module, use paths relative to that module:

``` javascript
import { encodeManchester } from "../encoding/manchester.js";
```

Do not use Node-only package resolution assumptions.

For GitHub Pages project sites, avoid root-relative imports such as:

``` javascript
import x from "/js/example.js";
```

because `/` refers to the domain root, not necessarily the repository
root.

## Protocol Registry

Protocols are explicitly registered in:

``` text
js/protocols/index.js
```

A zero-build browser application cannot enumerate an ES-module directory
at runtime, so the small explicit registry is intentional.

Typical registry:

``` javascript
import binary from "./binary.js";
import came12 from "./came12.js";
import lrs from "./lrs.js";
import tesla from "./tesla.js";
import pwm from "./pwm.js";
import oregonThgr122nx from "./oregon-thgr122nx.js";
import acurite5n1 from "./acurite-5n1.js";

export const protocols = Object.freeze([
    binary,
    came12,
    lrs,
    tesla,
    pwm,
    oregonThgr122nx,
    acurite5n1,
]);

export function getProtocol(id) {
    return protocols.find((protocol) => protocol.id === id) ?? null;
}
```

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

Named exports may coexist with the default descriptor:

``` javascript
export function buildPacket(...) {
    // ...
}

export default protocol;
```

This is useful for unit testing packet builders independently from the
UI.

## Dynamic Protocol UI

`js/ui/protocols.js` renders protocol fields declared by the selected
plugin.

Supported field concepts include:

-   text
-   number
-   checkbox
-   textarea
-   select

The renderer should remain generic. Protocol-specific DOM should
normally not be added to `index.html`.

## Encoding Layer

Reusable waveform algorithms belong in:

``` text
js/encoding/
```

Current examples include:

-   `pwm.js`
-   `manchester.js`

Protocol modules should reuse these helpers where the protocol maps
cleanly onto them.

Protocol-specific framing, checksums, parity, or unusual waveform
behavior should remain in the protocol module.

## Device Layer

`js/rfcat/device.js` is the hardware abstraction.

It owns:

-   WebUSB connection
-   RFCat framing
-   command/response handling
-   register peek/poke
-   RF modes
-   frequency
-   data rate
-   bandwidth
-   modulation
-   deviation
-   Manchester configuration
-   sync configuration
-   packet configuration
-   PA configuration
-   external amplifier control
-   transmission

The device layer should not know names such as Acurite, CAME, Tesla, or
Oregon.

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
particularly the external amplifier.

A typical pattern is:

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
RX is stopped.

Register access while listening has been observed to disturb reception.

Lowball configuration should therefore be applied before RX rather than
continuously manipulated during reception.

## Adding a Protocol

1.  Create `js/protocols/<protocol>.js`.
2.  Keep packet construction independent where practical.
3.  Export testable helpers as named exports.
4.  Add the default protocol descriptor.
5.  Register it in `js/protocols/index.js`.
6.  Add unit tests under `tests/`.
7.  Add protocol documentation under `docs/protocols/`.
8.  Verify the generated waveform independently with an SDR when
    possible.

## Testing Strategy

Prefer several levels of verification:

``` text
Known-answer unit test
        ↓
Generated packet inspection
        ↓
Generated waveform inspection
        ↓
SDR pulse measurement
        ↓
Independent decoder
        ↓
Real receiver, when appropriate
```

The Acurite implementation is an example of why this matters: packet
bytes and analyzer output looked correct before OTA polarity was
adjusted for the actual decoder path.

## GitHub Pages Debugging

If the HTML loads but the application does not initialize:

1.  Open DevTools.
2.  Check the Console for the first module error.
3.  Check Network for JavaScript `404` responses.
4.  Verify every import includes `.js`.
5.  Verify relative paths.
6.  Verify exact filename capitalization.
7.  Verify the exporting module actually exports the requested name.

Common errors include:

``` text
Failed to resolve module specifier
```

``` text
does not provide an export named
```

and module requests returning `404`.

## Documentation Policy

Keep the root `README.md` concise.

Use:

-   `README.md` for project overview and quick start.
-   `DEVELOPER.md` for architecture and extension instructions.
-   `docs/README.md` as the documentation index.
-   `docs/protocols/*.md` for protocol research, packet layouts, RF
    timing, test vectors, and validation notes.

## RF Waveform Preview

Protocols that return both `waveform` and `analysis` receive a live pre-transmit waveform preview in the browser.

`js/encoding/waveform.js` provides hardware-independent helpers for waveform packing, run analysis, CC1111 data-rate quantization, pulse timing, and timing-error calculation. `js/ui/waveform.js` owns visualization only.

A protocol can attach analysis metadata with `buildWaveformAnalysis()` without touching WebUSB. The preview displays the logical packet/bits when available, RF symbol count, quantized CC1111 symbol rate, symbol period, duration, payload size, padding, a waveform trace, and desired-versus-actual timing.

This keeps the design rule intact: protocol encoding and timing analysis are pure functions; device configuration remains in `js/rfcat/device.js`.
