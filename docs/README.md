# RFCat Web documentation

Technical reference, protocol notes, and validation guidance for the [RFCat Web RF development workspace](../README.md).

## Start here

| Guide | Covers |
| --- | --- |
| [Offline capture replay](capture-replay.md) | Offline timed playback, timeline navigation, saved-session comparison, JSON/CSV report export, guided Help and Playwright acceptance |
| [UI polish and reliability](polish-reliability.md) | Shared radio status, Tools shortcut, regression tests, and browser acceptance checklist |
| [Guided onboarding and help](help/README.md) | First-run wizard, contextual help, guided and protocol-specific tutorials (including live burst grouping), receiver troubleshooting, and browser verification |
| [RF Signal Analyzer](signal-analyzer.md) | Flipper RAW import, draggable timing cursors, local persistence, guided YARD Stick One scanning, validation, and limitations |
| [Intelligent Receiver & Capture Pipeline](capture-pipeline.md) | Live packet burst grouping, configurable duplicate window, RSSI ranges, JSON export, guided test matrix and limitations (merged) |
| [Receiver and Protocol Decoders](receiver-decoders.md) | Capture, raw/auto decode, POCSAG/CAME/Retekess RX, offline import, sessions, compare, inference, and preset builder |
| [Morse Code / CW Workbench](cw-workbench.md) | Morse encoding, OOK waveform and sidetone preview, raw OOK TX/RX, Flipper RAW import, guided wizard and hardware caveats (merged into main) |
| [RF Test Bench](rf-test-bench.md) | Packet builder, bounded TX sequences, RX comparison, safety checks and manual validation |
| [Radio Configuration](radio.md) | CC1111 registers, RF settings, amplifier behavior, lowball receive, and timing quantization |
| [RFCat USB Protocol](rfcat-usb.md) | WebUSB endpoints, framing, commands, connect/reconnect, and TX/RX transport |
| [Momentum Enhanced Sub-GHz Chat](momentum-subghz-chat.md) | Optional Flipper Zero interoperability: plaintext, AES-256-GCM, hardware test steps, and limitations |

## Development workflows

**Receive and analyze:** Configure RF → capture or import → select decoder → inspect raw and decoded data → save a session → compare captures → infer fields → validate a protocol preset → export JSON.

**Develop a protocol:** Implement metadata and UI fields, `encode()` for packet TX, `configure()` for RF setup, optional `transmit()` for direct modes, and `decode(bytes, context)` for RX. Register the module in `js/protocols/index.js`; add tests and a protocol-specific document. Protocols should call the device API, not construct USB frames.

**Export configuration:** The IPython exporter records protocol configuration operations and renders equivalent rflib commands. Direct TX protocols can require custom handling.

**Run tests:** `npm run verify` runs both Node and Playwright tests locally, without paid CI. `npm test` runs Node's test suite. After `npm install` and `npx playwright install chromium`, `npm run test:browser` runs the browser regression suite, including the original 15 UI regression tests and four replay acceptance tests, including simulated WebUSB connection, retry, failure, and recovery cases. See [UI polish and reliability](polish-reliability.md). CI runs through GitHub Actions; inspect the workflow status before interpreting a change as verified.

## Protocol reference

| Family | Documentation |
| --- | --- |
| Paging | [POCSAG](protocols/pocsag.md), [LRS](protocols/lrs.md), [Retekess](protocols/retekess.md) |
| OOK / remote | [CAME-12](protocols/came12.md), [Generic OOK/PWM](protocols/pwm.md), [Tesla charge port](protocols/tesla.md), [TouchTunes](protocols/touchtunes.md) |
| Weather / sensor | [Acurite 5n1](protocols/acurite-5n1.md), [Oregon THGR122NX](protocols/oregon-thgr122nx.md) |
| TPMS | [Schrader EG53MA4](protocols/schrader-eg53ma4.md), [MRXBC5A4](protocols/schrader-mrxbc5a4.md), [MRXGG4](protocols/schrader-mrxgg4.md), [SMD3MA4](protocols/schrader-smd3ma4.md) |

Additional implementations (including JTECH, Binary, and Continuous Carrier) may not have a standalone protocol document; see the source modules under `js/protocols/`.

## Implementation map

| Location | Responsibility |
| --- | --- |
| `app.js`, `index.html` | UI and event wiring |
| `js/rfcat/`, `js/radio/` | RFCat transport and CC1111 configuration |
| `js/protocols/` | Protocol-specific encoding, configuration, TX, and optional decoding |
| `js/rx/`, `js/encoding/` | Capture processing and waveform/timing tools |
| `js/storage/` | Browser-local capture sessions and persistence |
| `js/chat/` | Momentum chat packet handling |
| `tests/`, `browser-tests/`, `tools/` | Node tests, Playwright/browser mock-WebUSB tests, and synthetic signal utilities |

## Validation terminology

- **Implemented:** Code exists; no test result implied.
- **Synthetic/unit validated:** Local test vectors or generated signals match expected results.
- **OTA waveform validated:** An independently captured radio waveform matches the intended encoding/timing.
- **Device interoperability validated:** A real target device successfully exchanges or receives the relevant traffic.

Hardware evidence is **feature- and direction-specific**. For example, a successful encrypted Flipper → RFCat Web message does not by itself verify encrypted RFCat Web → Flipper. Individual protocol guides record their evidence and unresolved cases.

## Safety

Operate only on authorized frequencies and equipment. Prefer controlled, short bench transmissions; consult each protocol's scope and validation notes before relying on real-device behavior.

## Guided Help and diagnostics

[Guided Help](help/README.md) documents the welcome wizard, illustrated topic cards, advanced interactive tutorials, contextual field help, and read-only RF troubleshooting. The Radio panel uses aligned checkbox/label/help controls. Tests and browser acceptance checks are documented there.

**Advanced Signal Analysis (Milestone 4):** See [RF Signal Analyzer](signal-analyzer.md) for interactive timing histograms, decode hypothesis exploration, repeated-frame comparisons, report export and limitations.


- [Protocol Reverse-Engineering Workbench](protocol-workbench.md) — candidate bit fields, frame differences, checksum hints and JSON definitions.

