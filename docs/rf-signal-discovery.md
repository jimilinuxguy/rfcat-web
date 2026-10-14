# RF signal discovery — experimental

This workflow links **Analyze → Sub-GHz Spectrum Explorer** with the existing receiver preset scan, Receiver capture pipeline and Capture Library. It does not identify modulation automatically and does not transmit.

## Guided test

1. Connect a YARD Stick One, stop any competing radio activity, and capture a baseline with the test transmitter silent.
2. Perform a signal scan with an authorized transmitter active. Inspect average, peak, baseline rise and the waterfall. A burst candidate is not proof of a protocol.
3. Hover over the desired frequency bin and click **Investigate strongest signal**. If no bin is hovered, the strongest bin is selected. The investigation freezes its RSSI evidence at selection time.
4. Choose **Open receiver preset scan** to fill in the scan frequency. Start the existing bounded preset scanner yourself. Its packet counts and raw bytes are evidence, not proof of the modulation. The preset scanner restores modem registers and leaves the radio idle.
5. Choose **Open receiver capture** to populate the main receiver frequency field. Apply the radio settings manually and start listening. Inspect packet bytes and decoded results. A packet chunk is not necessarily a complete OTA frame.
6. Choose **Save investigation with captures**. A **new** Capture Library session stores the spectrum settings, baseline, per-frequency summary and raw RSSI samples under `investigation`, together with receiver captures added since the investigation was selected. Earlier captures are intentionally excluded.
7. Use **Export investigation JSON** for a spectrum-only portable snapshot. The JSON export does not include receiver captures; those live in the saved Capture Library session. Use the existing session export facilities to retain receiver evidence.
8. Open **? Help → Advanced analysis → RF signal discovery: spectrum to capture** for the guided walkthrough. The wizard never operates the radio.

## Validation and limitations

Run `npm run verify` (Node + Playwright) and repeat the guided test on YARD Stick One hardware. Test selection of an ordinary bin and the strongest bin, a scan with and without baseline, empty captures, captured packets, cancelled scans, and saved-session reopening. Validate restoration and frequency readback independently. An investigation is a snapshot of one scan, not a continuous RF recording; its JSON may be large with many passes. Saved session captures are the current receiver pipeline's packet evidence, not demodulated raw RF waveform samples. Receiver preset results are not automatically attached to the investigation in this iteration. Browser-local IndexedDB can be cleared by the user or browser; export important evidence.

**Status:** feature branch awaiting automated and manual validation. No PR should be opened before tests are confirmed.
