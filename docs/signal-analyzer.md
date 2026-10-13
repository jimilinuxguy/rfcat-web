# RF Signal Analyzer

The RF Signal Analyzer panel imports Flipper Zero `.sub` files using `Protocol: RAW`, including multiline `RAW_Data` signed integer microsecond durations. It preserves source text and metadata, plots the digital level transitions, and displays timing clusters, gaps, potential frame segments, and ranked encoding hypotheses.

The analysis engine is in `js/rx/signal-fingerprint.js`; the UI lives in `js/ui/signal-analyzer.js`. Both use the existing no-bundler ES module architecture. Run `npm test` for unit tests.

## Evidence limitations

A Flipper preset describes the receiver configuration, not independently confirmed transmitted modulation. Flipper RAW data are demodulated pulse timings, not IQ samples. OOK/ASK and FSK can produce identical digital pulse trains. Estimated symbol rates and encoding scores are heuristic and should not be treated as decoded or verified protocol information. Frame splitting uses long low-level gaps and can miss packets or split a valid packet.

## Implemented scope and limitations

Implemented: offline RAW import (4 MiB file limit), source preservation, timing clustering, gap segmentation, heuristic candidate rankings, NRZ/Manchester/differential Manchester/PWM/PPM bitstream hypotheses, basic bit-position comparison API, interactive zoom/pan waveform, two draggable waveform measurement cursors with numerical microsecond inputs, and multiple-capture IndexedDB save/load/delete through a dedicated versioned signal-analyses store.

Implemented guided sequential RFCat receiver-preset scanning (ASK/OOK, 2-FSK and GFSK) with packet counts, packet hex, cancellation between dwell windows, and best-effort radio register restoration to IDLE. Scan evidence is packet-mode data, **not** raw pulse edges or independently verified modulation. Scan operation can interrupt existing receiver workflows. Not yet implemented: live RX pulse-edge capture normalization in the UI, validated protocol bitstream reconstruction, verified repeated-frame decoding, reliable preamble/sync detection, and cross-linking with the receiver capture-session library. The existing RFCat packet receiver is not an IQ receiver. Scanning would necessarily be sequential and can miss brief or nonrepeating signals. Basic scanning on a connected YARD Stick One has been reported working. Nonzero packet-byte detection, cancellation behavior, and exact radio configuration restoration remain separate validation checks.

Do not describe this initial implementation as verified modulation discovery.

## Waveform cursors

Click the waveform to move the nearest of Cursor A (amber) or Cursor B (red) to that absolute microsecond position; drag while holding the pointer to move it. The numeric inputs update continuously and remain editable for precise measurements. Δt shows their absolute separation. Zoom and Pan change the visible time window; cursor values remain absolute positions in the capture. A cursor outside the current window is hidden until it is visible again. Pointer positions are scaled to the canvas dimensions so responsive layouts and Retina displays work correctly.

## Guided hardware scan

Connect a YARD Stick One, enter a supported CC1111 frequency and dwell duration, and choose **Scan receiver presets**. The scanner sequentially configures five receive profiles, reports packet counts and hex data for each, and restores radio configuration on completion or failure, leaving the radio in IDLE. Cancel stops after the active dwell period. Use only on frequencies you are authorized to monitor. The scanner does not transmit. A packet count of zero does not establish absence of RF activity, and nonzero counts do not prove modulation identity. The user reports basic scanning works on physical hardware; specific packet reception and restoration scenarios have not been independently confirmed.

## Frame and sync hypotheses

The UI compares candidate NRZ bitstreams from up to twelve detected frames, aligning offsets and marking varying bit positions. Alternating preamble and repeated sync candidates are heuristic; their presence does not confirm a protocol. Frame boundaries depend on long negative gaps and may be inaccurate.

## Validation status

The user reports successful browser tests of RAW import, waveform cursor dragging, and IndexedDB save/load/delete, as well as a successful basic guided scan with YARD Stick One. The user also previously reported 185 passing local Node tests before the draggable cursor additions; the cursor coordinate mapping tests were added afterward and require a fresh local `npm test` run to verify the final branch. A successful scan does not by itself confirm nonzero packet capture, cancellation, or complete radio restoration. GitHub Actions hosted runs have been blocked by runner billing restrictions; this is not evidence of failing test assertions.

### Browser smoke test

1. Serve the repository with `python3 -m http.server 8000` and open `http://localhost:8000` in Chrome or Edge.
2. Import a Flipper `Protocol: RAW` `.sub` file; inspect frequency, timing clusters, gap/frame hypotheses, and waveform.
3. Zoom and pan, click/drag both cursors, verify their numeric inputs and `Δt` in microseconds.
4. Save a capture, refresh, load it, then delete it; confirm persistence and deletion.
5. Reject malformed files and non-RAW protocols with an import error.

### Hardware smoke test

1. Connect YARD Stick One, note current radio configuration, and scan an authorized frequency.
2. Confirm all five presets are evaluated; packet counts may be zero without indicating a scanner failure.
3. Test cancellation separately, then read back the radio configuration and verify it was restored and left IDLE.
4. Verify normal receiver operation still works after scanning. For packet-byte validation, use a known-compatible transmitter and framing configuration.

### Automated tests

Run `npm test` on the feature branch or merged main. Unit tests cover timing analysis, decoding heuristics, persistence helpers, scanner logic, and cursor coordinate transforms. Automated tests do not replace browser or over-the-air verification.
