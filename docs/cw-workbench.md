# Morse Code / CW Workbench

This workbench is included in the main application.

## Capabilities

- International Morse text encoding (A–Z, 0–9 and common punctuation), strict 120-character limit.
- Key rate 5–40 WPM. Standard PARIS timing: dot = 1200/WPM ms; dash = 3 dots; gaps = 1, 3 and 7 dots.
- Offline Morse code, timing, waveform canvas and 650 Hz browser sidetone.
- OOK waveform packing into raw sampled bytes, 500–5000 symbols/s, with a strict 255-byte packet cap.
- YARD Stick One / CC1111 OOK TX: explicit frequency selection in supported bands, authorization checkbox, confirmation dialog, no active RX/chat/scanning/bench TX. Configures OOK, fixed-length, no sync/CRC/whitening/Manchester, then transmits the packed waveform. Radio settings remain changed after sending.
- Live RX comparison of raw packet bytes as Morse, plus offline paste-and-decode for raw OOK sample bytes and Flipper Zero RAW `.sub` pulse-file import. Fixed WPM or simple automatic pulse-unit estimation.
- JSON export of waveform plan, raw bytes and most recent firmware acknowledgement.
- Nine-step guided wizard and contextual Help.

## Important limitations

**This is Sub-GHz sampled OOK Morse, not conventional HF continuous-wave reception or an audio CW decoder.** The CC1111 firmware's packet transmitter, modem state machine and FIFO can change or truncate intended timing. A firmware acknowledgement **does not** prove a correct RF waveform. TX is restricted to one bounded packet (maximum 255 bytes); longer messages require a different continuous-stream firmware path, not unsafe browser-timed keying.

RX expects a demodulated *raw OOK bitstream* at the specified symbol rate. Do not feed ASCII text, decoded protocol packets or a Flipper `.sub` text file into the raw hex field. The receiver may split frames across packet boundaries. The live decoder now reconstructs a continuous sample stream across active packet boundaries, ignores only full frames matching the observed idle signature (`C0` followed by zeroes, or all-zero frames), and finalizes a candidate when idle resumes. It preserves completed messages and reports RX frame counts. This is a heuristic: if a genuine transmission contains a whole frame matching the idle signature, it can be misclassified. Auto WPM is a simple shortest-pulse estimator and may misclassify all-dash traffic or noise. Validate with known test signals before relying on results.

## First test pass

1. Open the CW panel **without hardware**. Preview `SOS` at 20 WPM, 1000 symbols/s; check dots/dashes, waveform and byte count.
2. Play the sidetone; verify no radio activity. Check that unsupported characters, empty input, WPM outside 5–40, and overlong packets show validation errors.
3. Export Morse JSON; verify `rfcat-web.cw.v1`, message, timing runs, raw hex and sample rate.
4. Paste the exported `rawHex` into offline RX; set matching sample rate and WPM; verify `SOS`. Repeat with automatic WPM. Import a Flipper RAW `.sub` file with Morse pulse timings and check decoded text.
5. Launch the CW wizard and walk all nine steps. Check Help and narrow-screen layout.
6. With a disconnected radio, check TX refusal. With a connected radio, test unchecked authorization, confirmation cancellation, and active RX/chat/scanning safeguards.
7. On an **authorized bench setup**, transmit a short Morse message. Capture the actual OOK envelope with a second independent receiver or Flipper RAW capture. Compare measured dot/dash durations with the preview. Do not assume the firmware TX ACK guarantees keying accuracy.
8. Configure the main Receiver for raw OOK (no sync, CRC, whitening or status) at the same sample rate. Enable live CW decode and send a known test signal from a separate transmitter. Verify frame counts increase, active frames are detected, and completed messages persist after idle frames. Try `SOS` at 20 WPM. Check Clear Morse RX and speed/rate changes.
9. Check existing Receiver, Test Bench, Momentum Chat and Protocol Transmitter for regressions.
10. Run `npm test` and inspect browser console.

**Hardware validation is required before declaring on-air CW TX/RX functional.**
