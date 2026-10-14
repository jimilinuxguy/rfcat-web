# Sub-GHz Spectrum Explorer

Analyze → **Sub-GHz Spectrum Explorer** (collapsed by default).

This is a **stepped-frequency CC1111 RSSI survey**, not an SDR FFT or calibrated spectrum analyzer. The radio is tuned sequentially and sampled after a configurable dwell. Short transmissions between dwell windows may be missed.

## Usage

Connect YARD Stick One, stop receiver listening / Momentum chat / other scans, expand Spectrum Explorer, select start/stop MHz, 10–1000 kHz step and 20–2000 ms dwell, then Start sweep. The scanner supports CC1111 bands 300–348, 387–464, and 779–928 MHz, with a maximum of 600 points per sweep. It does not cross unsupported gaps. Stop cancels the current sweep; hardware commands already in progress must finish first.

The chart shows RSSI samples and highlights measurements above the configurable threshold. Click the chart to populate the radio frequency form, then apply radio configuration before receiving. Export CSV writes frequency (Hz), estimated RSSI (dBm) and timestamp.

The CC1111 RSSI register uses signed half-dB steps with a nominal -74 dB offset; displayed dBm values are estimates, **not calibrated absolute power**. Peaks indicate activity or interference, not decoded transmissions or confirmed modulation. This version captures a single sweep, not a scrolling waterfall or continuous monitor.

## Safety and restoration

Read-only RF operation (no transmission). The scan saves CC1111 modem configuration registers, restores them on success, cancellation and error, and deliberately leaves the radio idle. If restoration fails, the UI reports an error and the user should reconnect and reconfigure before further RF operations. Avoid starting other radio tasks while scanning.

## Verification

`npm run verify` includes grid/RSSI/register restoration unit tests and a hardware-free Playwright UI smoke test. **Actual RSSI values and restoration behavior still require YARD Stick One hardware validation.**
