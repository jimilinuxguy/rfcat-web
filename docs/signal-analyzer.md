# RF Signal Analyzer (work in progress)

The RF Signal Analyzer panel imports Flipper Zero `.sub` files using `Protocol: RAW`, including multiline `RAW_Data` signed integer microsecond durations. It preserves source text and metadata, plots the digital level transitions, and displays timing clusters, gaps, potential frame segments, and ranked encoding hypotheses.

The analysis engine is in `js/rx/signal-fingerprint.js`; the UI lives in `js/ui/signal-analyzer.js`. Both use the existing no-bundler ES module architecture. Run `npm test` for unit tests.

## Evidence limitations

A Flipper preset describes the receiver configuration, not independently confirmed transmitted modulation. Flipper RAW data are demodulated pulse timings, not IQ samples. OOK/ASK and FSK can produce identical digital pulse trains. Estimated symbol rates and encoding scores are heuristic and should not be treated as decoded or verified protocol information. Frame splitting uses long low-level gaps and can miss packets or split a valid packet.

## Current scope and outstanding work

Implemented: offline RAW import (4 MiB file limit), source preservation, timing clustering, gap segmentation, heuristic candidate rankings, NRZ/Manchester/differential Manchester/PWM/PPM bitstream hypotheses, basic bit-position comparison API, interactive zoom/pan waveform, two numerical measurement cursors, and multiple-capture IndexedDB save/load/delete through a dedicated versioned signal-analyses store.

Implemented guided sequential RFCat receiver-preset scanning (ASK/OOK, 2-FSK and GFSK) with packet counts, packet hex, cancellation between dwell windows, and best-effort radio register restoration to IDLE. Scan evidence is packet-mode data, **not** raw pulse edges or independently verified modulation. Scan operation can interrupt existing receiver workflows. Not yet implemented: live RX pulse-edge capture normalization in the UI, drag-to-position waveform cursors, validated protocol bitstream reconstruction, repeated-frame alignment, reliable preamble/sync detection, and cross-linking with the receiver capture-session library. The existing RFCat packet receiver is not an IQ receiver. Scanning would necessarily be sequential and can miss brief or nonrepeating signals. Physical CC1111 configuration compatibility and over-the-air behavior still require testing on a connected YARD Stick One.

Do not describe this initial implementation as verified modulation discovery.

## Guided hardware scan

Connect a YARD Stick One, enter a supported CC1111 frequency and dwell duration, and choose **Scan receiver presets**. The scanner sequentially configures five receive profiles, reports packet counts and hex data for each, and restores radio configuration on completion or failure, leaving the radio in IDLE. Cancel stops after the active dwell period. Use only on frequencies you are authorized to monitor. The scanner does not transmit. A packet count of zero does not establish absence of RF activity, and nonzero counts do not prove modulation identity. Hardware behavior remains unverified until tested on a physical device.
