# RF Signal Analyzer (work in progress)

The RF Signal Analyzer panel imports Flipper Zero `.sub` files using `Protocol: RAW`, including multiline `RAW_Data` signed integer microsecond durations. It preserves source text and metadata, plots the digital level transitions, and displays timing clusters, gaps, potential frame segments, and ranked encoding hypotheses.

The analysis engine is in `js/rx/signal-fingerprint.js`; the UI lives in `js/ui/signal-analyzer.js`. Both use the existing no-bundler ES module architecture. Run `npm test` for unit tests.

## Evidence limitations

A Flipper preset describes the receiver configuration, not independently confirmed transmitted modulation. Flipper RAW data are demodulated pulse timings, not IQ samples. OOK/ASK and FSK can produce identical digital pulse trains. Estimated symbol rates and encoding scores are heuristic and should not be treated as decoded or verified protocol information. Frame splitting uses long low-level gaps and can miss packets or split a valid packet.

## Current scope and outstanding work

Implemented: offline RAW import (4 MiB file limit), source preservation, timing clustering, gap segmentation, heuristic candidate rankings, NRZ/Manchester/differential Manchester/PWM/PPM bitstream hypotheses, basic bit-position comparison API, interactive zoom/pan waveform, two draggable waveform measurement cursors with numerical microsecond inputs, and multiple-capture IndexedDB save/load/delete through a dedicated versioned signal-analyses store.

Implemented guided sequential RFCat receiver-preset scanning (ASK/OOK, 2-FSK and GFSK) with packet counts, packet hex, cancellation between dwell windows, and best-effort radio register restoration to IDLE. Scan evidence is packet-mode data, **not** raw pulse edges or independently verified modulation. Scan operation can interrupt existing receiver workflows. Not yet implemented: live RX pulse-edge capture normalization in the UI, validated protocol bitstream reconstruction, verified repeated-frame decoding, reliable preamble/sync detection, and cross-linking with the receiver capture-session library. The existing RFCat packet receiver is not an IQ receiver. Scanning would necessarily be sequential and can miss brief or nonrepeating signals. Physical CC1111 configuration compatibility and over-the-air behavior still require testing on a connected YARD Stick One.

Do not describe this initial implementation as verified modulation discovery.

## Waveform cursors

Click the waveform to move the nearest of Cursor A (amber) or Cursor B (red) to that absolute microsecond position; drag while holding the pointer to move it. The numeric inputs update continuously and remain editable for precise measurements. Δt shows their absolute separation. Zoom and Pan change the visible time window; cursor values remain absolute positions in the capture. A cursor outside the current window is hidden until it is visible again. Pointer positions are scaled to the canvas dimensions so responsive layouts and Retina displays work correctly.

## Guided hardware scan

Connect a YARD Stick One, enter a supported CC1111 frequency and dwell duration, and choose **Scan receiver presets**. The scanner sequentially configures five receive profiles, reports packet counts and hex data for each, and restores radio configuration on completion or failure, leaving the radio in IDLE. Cancel stops after the active dwell period. Use only on frequencies you are authorized to monitor. The scanner does not transmit. A packet count of zero does not establish absence of RF activity, and nonzero counts do not prove modulation identity. Hardware behavior remains unverified until tested on a physical device.

## Frame and sync hypotheses

The UI compares candidate NRZ bitstreams from up to twelve detected frames, aligning offsets and marking varying bit positions. Alternating preamble and repeated sync candidates are heuristic; their presence does not confirm a protocol. Frame boundaries depend on long negative gaps and may be inaccurate.

## Release validation

GitHub Actions runs have not completed successfully; the user reports hosted-runner billing restrictions. Do not merge until CI passes. The scanner and IndexedDB UI have not been validated on physical hardware and a browser respectively. GitHub-hosted runners may be unavailable due to account billing; this is not evidence of a failed Node assertion. Run `npm test` locally and capture its output before marking the PR ready.
