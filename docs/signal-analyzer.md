# RF Signal Analyzer (work in progress)

The RF Signal Analyzer panel imports Flipper Zero `.sub` files using `Protocol: RAW`, including multiline `RAW_Data` signed integer microsecond durations. It preserves source text and metadata, plots the digital level transitions, and displays timing clusters, gaps, potential frame segments, and ranked encoding hypotheses.

The analysis engine is in `js/rx/signal-fingerprint.js`; the UI lives in `js/ui/signal-analyzer.js`. Both use the existing no-bundler ES module architecture. Run `npm test` for unit tests.

## Evidence limitations

A Flipper preset describes the receiver configuration, not independently confirmed transmitted modulation. Flipper RAW data are demodulated pulse timings, not IQ samples. OOK/ASK and FSK can produce identical digital pulse trains. Estimated symbol rates and encoding scores are heuristic and should not be treated as decoded or verified protocol information. Frame splitting uses long low-level gaps and can miss packets or split a valid packet.

## Current scope and outstanding work

Implemented: offline RAW import (4 MiB file limit), source preservation, timing clustering, gap segmentation, heuristic candidate rankings, NRZ/Manchester/differential Manchester/PWM/PPM bitstream hypotheses, basic bit-position comparison API, interactive zoom/pan waveform, two numerical measurement cursors, and single-capture localStorage save/load/delete. localStorage is separate from the existing IndexedDB capture library and can be unavailable or quota-limited.

Not yet implemented: hardware-driven sequential RFCat scanning, live RX capture normalization in the UI, drag-to-position waveform cursors, validated protocol bitstream reconstruction, repeated-frame alignment, reliable preamble/sync detection, and IndexedDB capture-library integration. The existing RFCat packet receiver is not an IQ receiver. Scanning would necessarily be sequential and can miss brief or nonrepeating signals. Physical CC1111 configuration compatibility and over-the-air behavior still require testing on a connected YARD Stick One.

Do not describe this initial implementation as verified modulation discovery.
