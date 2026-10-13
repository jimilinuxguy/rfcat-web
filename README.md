# RFCat Web

**A browser-based RF development, capture, and protocol-analysis workspace for RFCat-compatible CC1111 hardware, including the YARD Stick One.**

RFCat Web uses WebUSB to configure radios, transmit test frames, capture and decode traffic, inspect waveforms, and build or validate protocol definitions. The project is a general-purpose RF engineering tool—not a single-protocol or Flipper-specific application.

## What you can do

- **Configure and transmit:** Set frequency, modulation, data rate, bandwidth, power, and packet settings; transmit using protocol-specific encoders or direct RF test modes. The RF Test Bench previews bounded hexadecimal packet sequences and compares subsequent RX packets byte-for-byte.
- **Receive and decode:** Inspect raw captures, select decoders, and review decoded fields. Auto mode attempts applicable decoders without discarding unknown traffic. Live burst diagnostics group repeated packet events with timestamps, RSSI ranges, adjustable duplicate windows, and JSON export.
- **Analyze captures offline:** Import/export JSON, save capture sessions in IndexedDB, step through loaded captures with the M11 offline replay inspector, compare captures, infer changing fields, and validate declarative protocol presets against positive and negative examples.
- **Investigate unknown RF timing:** Import Flipper Zero RAW `.sub` captures in the RF Signal Analyzer panel, inspect waveforms, and review conservative encoding hypotheses. See [RF Signal Analyzer](docs/signal-analyzer.md) for current scope and limitations.
- **Inspect signal timing:** Preview symbol timing and waveform quantization; analyze received OOK pulse distributions.
- **Get guided help:** An optional first-run wizard, searchable Help panel, contextual (?) explanations, and restartable, context-aware task-based and protocol-specific tours, including Intelligent Receiver & Burst Grouping. See [Guided onboarding and help](docs/help/README.md).
- **Customize your workspace:** Drag, resize, and collapse panels. Layout preferences persist locally in IndexedDB.
- **Interoperate with other devices:** Use specialized workflows such as Momentum Enhanced Sub-GHz Chat with a Flipper Zero.

## Quick start

**Requirements:** RFCat-compatible CC1111 hardware (YARD Stick One is the primary tested device), a WebUSB-capable browser, and a local HTTP server or secure origin. USB permission is granted through the browser.

```bash
git clone https://github.com/jimilinuxguy/rfcat-web.git
cd rfcat-web
python3 -m http.server 8080
```

Open `http://localhost:8080`, connect the YARD Stick One, configure the radio, and choose a transmit or receive workflow. Use only frequencies and devices you are authorized to operate.

Run the automated JavaScript and browser regression tests with:

```bash
npm install
npm test
npx playwright install chromium
npm run test:browser
```

The Playwright suite includes 15 hardware-free tests covering workspace navigation, persistence, Help, mock WebUSB handshake/readback, permission cancellation, disconnects, retries, write failures, and timeouts. See [M10 polish and reliability](docs/m10-polish-reliability.md). Mocked USB tests do not validate RF hardware or over-the-air behavior.

GitHub Actions also runs the Node test workflow. **Check the actual workflow result:** the presence of tests or a merged PR does not imply CI is passing.

## Protocols and interoperability

The protocol registry includes:

| Area | Implementations |
| --- | --- |
| Paging and alerting | POCSAG, LRS, JTECH, Retekess T112/T119/TD157/TD161/TD164/TD165/TD174 |
| OOK and remote signaling | CAME-12, generic OOK/PWM, Tesla charge-port test signaling, TouchTunes / The Fonz |
| Sensors and telemetry | Acurite 5n1, Oregon THGR122NX, Schrader TPMS variants |
| RF utilities | Binary payloads, Continuous Carrier |

Not all implementations have the same hardware-validation status. Protocol details, framing, known-good captures, and test boundaries live in [protocol documentation](docs/README.md#protocol-reference).

**Momentum Enhanced Sub-GHz Chat** is a separate interoperability panel (not a registry protocol). It supports plaintext and AES-256-GCM encrypted chat with compatible Flipper Zero firmware. See the [Momentum Chat guide](docs/momentum-subghz-chat.md) for setup, payload limits, and validation notes.

See [M11 offline capture replay](docs/m11-capture-replay.md) for playback controls, timeline, saved-session comparison, limitations and the Help/welcome-wizard walkthrough.

## Capture and protocol-development workflow

```text
Configure radio → Capture / Import → Decode → Save session
                                         ↓
                              Compare / Infer fields
                                         ↓
                             Build protocol preset
                                         ↓
                           Validate / Export JSON
```

Capture sessions and workspace layout are stored locally in the browser's IndexedDB. A protocol preset is an **analysis artifact**, not an automatically installed decoder or an automatic transmission. Exported captures and presets can be shared as JSON.

The [Intelligent Receiver & Capture Pipeline](docs/capture-pipeline.md) adds live burst grouping without suppressing the existing capture list. It tracks packet events rather than guaranteed complete RF frames. The receiver remains packet-engine based. Physical asynchronous OOK remotes may require pulse-oriented sampling, and raw receive boundaries are not always protocol-frame boundaries. See [Receiver and Protocol Decoders](docs/receiver-decoders.md).

The experimental [Morse Code / CW Workbench](docs/cw-workbench.md) adds text-to-Morse, adjustable WPM, offline timing/waveform and sidetone preview, CC1111 OOK packet transmission, raw-sample Morse decoding and Flipper RAW `.sub` pulse import. It is not an HF audio CW receiver; hardware TX/RX validation remains necessary.

See [RF Test Bench](docs/rf-test-bench.md) for repeat limits, authorization safeguards, and validation steps. RF Test Bench is available on `main`; hardware validation remains distinct from unit tests.

## Architecture

- `app.js` and `index.html`: UI and event wiring.
- `js/rfcat/` and `js/radio/`: WebUSB transport, RFCat device operations, and CC1111 radio registers.
- `js/protocols/`: protocol metadata, encoding, RF configuration, TX, and optional RX decoding.
- `js/rx/`, `js/encoding/`, and `js/storage/`: receive analysis, waveform/timing support, and local persistence.
- `js/chat/`: dedicated Momentum chat plaintext and encrypted packet handling.
- `tests/`: Node.js automated tests; `browser-tests/`: Playwright browser regression and mocked WebUSB tests; `tools/`: synthetic capture and waveform utilities.

Browser modules use explicit relative `.js` imports, and the protocol registry is explicit, so the app does not require a bundler.

## Validation and limitations

Different evidence levels mean different things: **unit/synthetic tests**, **over-the-air waveform checks**, and **real-device interoperability**. They are not interchangeable. Reported hardware results include POCSAG and LRS TX/RX, multiple Retekess variants, and Momentum chat exchanges; individual documentation pages describe exactly what was tested and what remains unverified. Do not assume every protocol or radio setup has been tested with every physical target.

For development details, hardware behavior, known-good setups, and limitations, start with the [documentation index](docs/README.md).

## Safety

Transmit only on equipment and frequencies you own or are authorized to use, and comply with local radio regulations. RF test modes should be used for short, controlled bench tests to avoid interference.

### RF Signal Analyzer

Import Flipper Sub-GHz RAW captures, inspect timing clusters and encoding hypotheses, compare candidate bits, and measure pulse timings with waveform cursors. Save analyses in IndexedDB. A connected YARD Stick One can sequentially scan ASK/OOK, 2-FSK and GFSK receiver presets and report packet evidence. Preset scanning is receive-only, interrupts other radio workflows, and does not prove modulation identity. See [signal analyzer guide](docs/signal-analyzer.md). Browser import, waveform cursor dragging, and local save/load/delete have been user-verified; basic YARD Stick One preset scanning has also been reported working. Packet-byte detection, cancellation, and exact configuration restoration are not independently confirmed. Hosted CI availability may be limited; run `npm test` locally.

## Guided Help and RF diagnostics

Use **? Help** to open the searchable, illustrated Help Center. Topics are grouped by radio configuration, signal analysis, capture/decoding, transmission/tools and secure chat; each has a compact SVG illustration and short explanation. Guided tutorials include interactive practice for capture comparison, field inference, preset validation, waveform timing and encrypted Momentum Chat. The welcome wizard is shown on first use and can be restarted from Help.

Choose **Troubleshoot receiver** for prioritized, read-only checks of connection, frequency, receive state, packet counts, decoding, rejections, duplicates and filters. Each finding links to the relevant control via **Inspect**, with a manual **Refresh checks** option. Findings are UI-state hypotheses, not direct RF measurements; Help never starts reception, transmits or applies radio settings. In the Radio panel, contextual help icons align beside field labels, and checkboxes sit beside their corresponding labels in clearly separated rows.

For complete walkthroughs, limitations and manual acceptance checks, see [Guided Help](docs/help/README.md). Run `npm test` locally; browser/hardware validation remains separate from unit tests.

**Milestone 4 — Advanced Signal Analysis:** The RF Signal Analyzer adds interactive high/low timing histograms with waveform highlighting, selectable decode hypotheses with polarity inversion, repeated-frame pulse comparison and JSON report export. See [Signal Analyzer](docs/signal-analyzer.md). These are offline heuristics, not verified modulation or protocol decoding.


**Milestone 5 — Protocol Reverse-Engineering Workbench:** Inspect candidate bits, name non-overlapping fields, view bit-order-aware hex/decimal values, identify variable regions across equal-length repeated frames, check simple sum8/xor8 hypotheses, and export a versioned protocol JSON definition. All findings are unverified and offline; definitions are not executable decoders. See [Protocol Workbench](docs/protocol-workbench.md).


### Workspace navigation (M9)

The interface now groups existing tools into **Receive**, **Transmit**, **Analyze**, **Protocols**, and **Tools** tabs. Receive shows packet capture and the capture library; Transmit shows the raw transmitter, sequence bench, and waveform preview; Analyze shows the signal analyzer and OOK pulse tools; Protocols contains Morse/CW and Momentum Chat; Tools contains the shared CC1111 radio configuration. The Activity log remains available across workspaces. The active tab is remembered locally under `rfcat.workspace.active.v1`. M10 adds a read-only status summary of the radio form (frequency, modulation, baud rate, and connection state) on every tab; click it to open Tools. These are form values, not independently verified radio register readings.

Workspace navigation preserves existing DOM controls and radio sessions when switching tabs; it does not yet extract protocol controllers into independent modules or add workspace-specific drag layouts. To configure the receiver, open **Tools** and return to **Receive**. No radio command is sent merely by changing tabs.
