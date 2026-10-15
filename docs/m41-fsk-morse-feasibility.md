# M41: 2-FSK Morse reception feasibility gate

Status: **software architecture reviewed; hardware/firmware capability unverified**. Do not describe 2-FSK Morse RX as supported until the acceptance criteria below pass on a YARD Stick One.

## Existing RFCat Web findings

- `js/cw/morse.js`: `decodeMorseRuns(runs, {wpm})` consumes duration-based mark/space runs and can be reused without OOK-specific logic.
- `js/cw/stream.js`: `createCwStream` converts packet bytes to uniformly sampled bits and treats all-zero and `C0 00...` frames as OOK idle. **Do not reuse this idle detection for FSK.** A valid FSK space stream can be all zeroes.
- `docs/cw-workbench.md`: current TX and RX are explicitly experimental sampled OOK, not continuous FSK reception.
- `js/radio/presets.js`, `js/rx/signal-scan.js` and existing LRS/JTECH/POCSAG implementations show 2-FSK configuration, not proof of continuous state recovery.

## Hardware constraints to establish

CC1111 hardware supports 2-FSK demodulation, but its packet engine and clock recovery are not equivalent to a timestamped, continuous discriminator output. Determine from TI CC1110/CC1111 documentation and the actual RFCat firmware whether there is an accessible path to recover arbitrary mark/space states and preserve elapsed time through long constant-symbol runs. Verify asynchronous serial mode pin routing **specifically for CC1111**, not just CC1110. Investigate internal sampling/firmware modification only if stock firmware cannot supply an adequate stream.

At 20 WPM, one dot is 60 ms, one dash is 180 ms, and word gaps are 420 ms. At 5 WPM, a word gap is 1.68 seconds. These intervals may stress packet-based clock recovery, FIFO behavior, and idle handling. RF packet acknowledgement alone is not evidence of timing fidelity.

## Non-destructive investigation plan

1. Inspect the pinned RFCat firmware revision, USB receive commands, modem settings, sync/packet modes, FIFO limits, data whitening/Manchester/CRC flags, and whether raw asynchronous demodulator samples are exposed.
2. Record the relevant CC1111 register settings and documented access limitations. Avoid assuming the CC1110 and CC1111 have identical externally accessible pins.
3. Make an **offline-only** adapter prototype that turns known FSK symbol samples into timed mark/space runs and feeds `decodeMorseRuns`. Explicitly define mark polarity and symbol rate. Do not label the input as real RF capture.
4. Generate deterministic test vectors for `SOS`, `A`, repeated dots, repeated dashes, leading/trailing spaces, 5/20/30 WPM, inverted polarity, packet boundary splits, long constant runs, and noise. Ensure an all-zero FSK space packet is never discarded merely because it is zero.
5. If stock firmware exposes a suitable stream, run receive-only tests using a second authorized FSK signal source and an independent capture/reference. Measure duration error, decode correctness, lost symbols and boundary behavior.
6. If stock firmware cannot expose continuous FSK states, document the specific blocker and evaluate a separately reviewed firmware experiment. No erase, flash, TX, or bootloader action as part of this feasibility gate.

## Go/no-go acceptance criteria

- Demonstrate a real CC1111/YARD Stick One demodulated 2-FSK state stream, with documented firmware version and receive configuration.
- Preserve mark/space timing across FIFO or packet boundaries, including long constant-state intervals.
- Decode known Morse at 5, 20 and 30 WPM from on-air test signals with reproducible captures and stated error rates.
- No OOK regression, no misleading FSK controls before hardware validation, and `npm test` passes.

## Decision

**Conditional / not yet proven.** Reuse the existing Morse timing decoder if the receive path can produce valid timed runs. Do not implement or advertise live FSK Morse RX until the hardware gate passes.

References: [TI CC1110/CC1111 datasheet](https://www.ti.com/lit/ds/symlink/cc1110-cc1111.pdf), [RFCat upstream](https://github.com/atlas0fd00m/rfcat), [existing CW workbench](cw-workbench.md).
