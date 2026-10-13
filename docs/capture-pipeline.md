# Milestone 6 — Intelligent Receiver & Capture Pipeline

Initial foundation: `js/rx/capture-pipeline.js` is a pure, hardware-independent engine for timestamped RX events. It groups adjacent identical byte payloads on the same frequency within a configurable time window, retains per-group first/last timestamps and RSSI range, and bounds event retention. Groups are consecutive burst groups, not global deduplication; a later repeated payload starts a new group after the time window or an intervening different packet.

The engine validates payload bytes, timestamps, frequency and RSSI; rejects out-of-order events; and has no WebUSB or TX side effects.

**Live RX integration:** The Receiver card now includes a collapsible Live burst grouping panel with a configurable 0–60,000 ms duplicate window, pause toggle, reset, last 15 burst summaries and JSON export. Packet events are ingested after status-byte removal and before protocol-specific rolling decode buffers. Grouping does **not** suppress packets, modify the existing capture list, or affect POCSAG duplicate filtering. Resetting the Receiver capture list also clears burst groups. A change to the time window resets the current grouping. No extra WebUSB commands are sent. This measures received packet chunks, not inferred over-the-air RF frames. The pipeline holds at most 1,000 recent events; group summaries reflect the retained groups. Browser and YARD Stick One hardware validation remain pending.


## Manual validation

1. Connect YARD Stick One, start Receiver listening, and transmit a known repeated packet in an authorized test setup.
2. Confirm Receiver packet list and decoder behavior are unchanged while Live burst grouping shows repeats and timestamps.
3. Change the duplicate window; verify it resets grouping. Pause grouping; verify normal RX continues.
4. Export JSON and inspect `schema`, `events`, `groups`, and the packet-level warning.
5. Clear Receiver and confirm the burst list resets. Test with POCSAG and Momentum Chat modes to confirm no unintended grouping of chat traffic.
6. Run `npm test` and check mobile layout and keyboard navigation.
