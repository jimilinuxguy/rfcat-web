# Milestone 6 — Intelligent Receiver & Capture Pipeline

Initial foundation: `js/rx/capture-pipeline.js` is a pure, hardware-independent engine for timestamped RX events. It groups adjacent identical byte payloads on the same frequency within a configurable time window, retains per-group first/last timestamps and RSSI range, and bounds event retention. Groups are consecutive burst groups, not global deduplication; a later repeated payload starts a new group after the time window or an intervening different packet.

The engine validates payload bytes, timestamps, frequency and RSSI; rejects out-of-order events; and has no WebUSB or TX side effects.

**Not yet integrated into live RX.** Next steps: locate the active receive event dispatcher, connect ingestion without changing packet decode behavior, expose burst grouping and diagnostics in the receiver UI, and validate with YARD Stick One hardware. Unit tests cover the pure engine; browser/hardware checks remain pending.
