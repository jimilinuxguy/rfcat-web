# RF Signal Analyzer (initial implementation)

The RF Signal Analyzer panel imports Flipper Zero `.sub` files using `Protocol: RAW`, including multiline `RAW_Data` signed integer microsecond durations. It preserves source text and metadata, plots the digital level transitions, and displays timing clusters, gaps, potential frame segments, and ranked encoding hypotheses.

The analysis engine is in `js/rx/signal-fingerprint.js`; the UI lives in `js/ui/signal-analyzer.js`. Both use the existing no-bundler ES module architecture. Run `npm test` for unit tests.

## Evidence limitations

A Flipper preset describes the receiver configuration, not independently confirmed transmitted modulation. Flipper RAW data are demodulated pulse timings, not IQ samples. OOK/ASK and FSK can produce identical digital pulse trains. Estimated symbol rates and encoding scores are heuristic and should not be treated as decoded or verified protocol information. Frame splitting uses long low-level gaps and can miss packets or split a valid packet.

## Scope and outstanding work

Implemented: offline RAW import, source preservation, timing clustering, gap segmentation, heuristic candidate rankings, capture comparison API, and interactive zoom/pan waveform.

Not yet implemented: hardware-driven sequential RFCat scanning, live RX capture normalization in the UI, waveform measurement cursors, bitstream reconstruction, repeated-frame alignment, reliable preamble/sync detection, and persistence integration. The existing RFCat packet receiver is not an IQ receiver. Scanning would necessarily be sequential and can miss brief or nonrepeating signals. Physical CC1111 configuration compatibility and over-the-air behavior still require testing on a connected YARD Stick One.

Do not describe this initial implementation as verified modulation discovery.
