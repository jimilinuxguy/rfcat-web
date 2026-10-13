# M11 — RF Capture Replay & Session Analysis

M11 begins with **offline capture replay**. The Capture Library now includes **Prepare replay**, **Previous**, and **Next** controls. Load or import a session, prepare a replay, and step through captures in original order. The inspector shows payload hex, byte length, available timestamp, and a session summary with total captures, unique payloads, repeated payloads, and total bytes.

This is **not RF transmission replay**: preparing or navigating a replay does not use WebUSB, change radio settings, or transmit. The current implementation is manual step-through, not timed playback. A session change resets the replay inspector; click Prepare replay again to snapshot the newly loaded captures.

The pure `js/rx/session-replay.js` module validates captures, caps a replay at 10,000 captures and each payload at 4,096 bytes, and computes summary statistics. Unit tests cover ordering, timestamps, repeated payloads, byte formats, and invalid inputs.

## Validation

Run `npm test` and `npm run test:browser`. For manual acceptance, open a saved session containing several captures, prepare replay, navigate to both ends, verify Previous/Next disable correctly, and check the displayed hex against the capture list. Start a new session and confirm the inspector resets. No hardware is needed.

## Planned expansion

Timed playback controls, richer timeline visualization, cross-session comparison, and analysis export remain future M11 increments; they are not claimed as implemented here.
