# Sub-GHz Spectrum Explorer

Analyze → **Sub-GHz Spectrum Explorer** (collapsed by default).

This is a **stepped-frequency CC1111 RSSI survey**, not an SDR FFT or calibrated spectrum analyzer. The radio is tuned sequentially and sampled after a configurable dwell. Short transmissions between dwell windows may be missed.

## Usage

Connect YARD Stick One, stop receiver listening / Momentum chat / other scans, expand Spectrum Explorer, select start/stop MHz, 10–1000 kHz step, 20–2000 ms dwell and 1–100 passes, then Start sweep. The scanner supports CC1111 bands 300–348, 387–464, and 779–928 MHz, with a maximum of 600 points per sweep. It does not cross unsupported gaps. Stop requests cancellation and immediately displays a stopping status; hardware commands and radio configuration restoration still must finish before controls unlock.

For baseline-relative detection, first click **Capture baseline (TX off)** with the transmitter silent, then click **Scan signal (TX on)** with the transmitter active. The baseline uses the average RSSI at each frequency and remains available until cleared or recaptured. Start/stop/step must match between baseline and signal scans. The chart has labeled MHz/dBm axes and separate traces for baseline average (gray), signal average (green) and signal peak (orange). A configurable minimum baseline rise (default 6 dB) highlights frequencies with a meaningful RSSI increase. Without a baseline, the absolute peak threshold still controls highlighting. Click the chart to populate the radio frequency form, then apply radio configuration before receiving. Export CSV writes scan settings, per-frequency count/average/peak/minimum/baseline/delta and the original frequency/RSSI/timestamp samples. The exported file includes comment-prefixed metadata and summary rows before raw samples; consumers of the older three-column format should select the raw-sample section.

The CC1111 RSSI register uses signed half-dB steps with a nominal -74 dB offset; displayed dBm values are estimates, **not calibrated absolute power**. Peaks indicate activity or interference, not decoded transmissions or confirmed modulation. This version supports repeated sweeps, per-frequency averages and peaks, and a time-ordered waterfall (up to 100 recent sweeps); it is not a simultaneous wideband spectrum analyzer. For a short Flipper transmission, try 433.820–434.020 MHz, 50 kHz step, 100 ms dwell and 10 passes. Peak hold helps catch intermittent signals but does not guarantee detection.

## Analysis dashboard

The dashboard includes a configurable target-frequency marker (default 433.920 MHz) on both charts, metric cards, a waterfall RSSI color legend and a mouse-hover readout showing sweep number, frequency and RSSI. Detection readouts distinguish sustained average RSSI rises from intermittent burst candidates (peak above baseline without average above threshold). Burst candidates are heuristic indicators, not verified transmissions.

The dashboard provides strongest-frequency, average RSSI, peak RSSI, baseline rise, detection-bin count, and per-frequency sample coverage. Switch the upper chart between **RSSI** (average/peak/baseline traces) and **Baseline rise** (dB difference with a detection threshold). The lower **waterfall** renders each sequential sweep as a time-ordered row, using frequency-aligned cells; missing measurements remain blank. Colors represent estimated RSSI ranges, not a calibrated spectrogram. For performance, the waterfall displays the most recent 100 sweeps. The radio samples one frequency at a time; a horizontal waterfall row is not a simultaneous wideband measurement.

## Chart scaling, hover and guided wizard

The upper chart defaults to **Auto (fit signal)**, scaling its dBm axis to the observed signal and baseline with padding and readable 5/10 dB ticks. Switch to **Fixed (−120 to −30 dBm)** for a consistent visual scale across scans. The scale changes only the display, not measured samples, threshold calculations or CSV data. **Baseline rise** displays differences in dB with its own scale, independent of the RSSI scale setting. Hover over the upper chart to see a crosshair and exact frequency, average RSSI, peak RSSI, baseline average and rise (where available). Hovering does not retune the radio; clicking a frequency still populates the radio configuration form. The target marker is independent of the hover crosshair.

Open **? Help → Spectrum Explorer walkthrough** for a guided sequence covering baseline capture, signal scan, axis scale, frequency chart, waterfall and CSV export. The wizard only highlights controls and explains steps; it never starts a scan or transmits RF.

## Safety and restoration

Read-only RF operation (no transmission). The scan saves CC1111 modem configuration registers, restores them on success, cancellation and error, and deliberately leaves the radio idle. If restoration fails, the UI reports an error and the user should reconnect and reconfigure before further RF operations. Avoid starting other radio tasks while scanning.

## Verification

`npm run verify` includes grid/RSSI/register restoration unit tests and a hardware-free Playwright UI smoke test. **Actual RSSI values and restoration behavior still require YARD Stick One hardware validation.**
