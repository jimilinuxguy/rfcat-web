# RFCat Web

Browser-native control of RFCat-compatible CC1111 radios using WebUSB.

RFCat Web communicates directly with RFCat firmware from the browser and
provides radio configuration, RX/TX controls, register inspection,
reusable RF encoders, waveform analysis, and a modular protocol system.
It is designed for devices such as the Great Scott Gadgets YARD Stick
One.

> Use RF transmission features only with equipment and systems you own
> or are explicitly authorized to test, and follow applicable spectrum
> rules.

## Features

-   Direct WebUSB RFCat communication
-   YARD Stick One / CC1111 radio control
-   Frequency, modulation, data-rate, bandwidth, deviation, sync, and
    packet configuration
-   RX and TX modes
-   CC1111 register inspection and radio readback
-   External amplifier control
-   Modular protocol plugins with dynamically generated UI
-   Reusable PWM and Manchester encoders
-   RF waveform preview and timing analysis
-   Unit-tested protocol encoding
-   Zero-build ES-module architecture suitable for GitHub Pages

## Supported Protocols

  Protocol                      Status
  ----------------------------- ----------------------------------------------------
  Binary                        Supported
  Generic OOK/PWM               Supported
  CAME 12-bit                   Experimental
  LRS Pager                     OTA validated
  Tesla Charge Port             Implemented / waveform validated
  Oregon Scientific THGR122NX   Experimental
  Acurite 5n1                   OTA validated with `rtl_433` checksum verification
  Schrader TPMS MRXGG4          OTA validated with `rtl_433` decoder #60
  Schrader TPMS EG53MA4         OTA validated with `rtl_433` decoder #95
  Schrader TPMS SMD3MA4         Source-derived; validation pending
  Schrader TPMS NIS315G3/3039   Source-derived; validation pending
  Schrader TPMS MRXBC5A4        Source-derived; validation pending

The Schrader protocol UIs display sensor IDs and flags in hexadecimal so
values correspond directly with typical `rtl_433` output.

See [Protocol Documentation](docs/README.md#protocols) for
implementation details.

## Quick Start

Serve the repository through HTTP/HTTPS. Do not open `index.html`
directly with `file://`.

``` bash
python3 -m http.server 8080
```

Then open:

``` text
http://localhost:8080/
```

Connect the YARD Stick One using the **Connect** button and approve the
WebUSB device prompt.

## GitHub Pages

RFCat Web uses native browser ES modules and does not require a bundler.

The entry script must be loaded as a module:

``` html
<script type="module" src="./app.js"></script>
```

Imports should use repository-relative paths and include the `.js`
extension:

``` javascript
import { getProtocol } from "./js/protocols/index.js";
```

Avoid root-relative imports such as `/js/...`, because a GitHub Pages
project site is normally served beneath the repository path.

Import filename capitalization must exactly match the file on disk.

## Tests

Run the test suite with:

``` bash
npm test
```

Protocol development also uses synthetic IQ samples and independent
`rtl_433` decoding where appropriate before OTA validation.

## Documentation

-   [Documentation Index](docs/README.md)
-   [Developer Guide](DEVELOPER.md)
-   [RFCat USB Protocol](docs/rfcat-usb.md)
-   [Radio Configuration](docs/radio.md)
-   [Schrader MRXGG4](docs/protocols/schrader-mrxgg4.md)
-   [Schrader EG53MA4](docs/protocols/schrader-eg53ma4.md)
-   [Schrader SMD3MA4 / NIS315G3](docs/protocols/schrader-smd3ma4.md)
-   [Schrader MRXBC5A4 / BMW](docs/protocols/schrader-mrxbc5a4.md)
-   [Acurite 5n1](docs/protocols/acurite-5n1.md)
-   [Oregon Scientific THGR122NX](docs/protocols/oregon-thgr122nx.md)
-   [LRS Pager](docs/protocols/lrs.md)
-   [Tesla Charge Port](docs/protocols/tesla.md)
-   [CAME 12-bit](docs/protocols/came12.md)
-   [Generic OOK/PWM](docs/protocols/pwm.md)

## Browser Support

A browser with WebUSB support is required. Chromium-based browsers are
the primary target.

## Project Goals

RFCat Web keeps hardware access isolated from protocol implementations,
protocol implementations modular, waveform encoders reusable, protocol
UI generic, and encoders independently testable.

The project deliberately uses plain HTML, CSS, JavaScript modules,
WebUSB, and lightweight tests rather than requiring a frontend build
system.

## License

See the repository license for licensing terms.
