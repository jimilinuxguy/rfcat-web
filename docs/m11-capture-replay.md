# M11 — RF Capture Replay & Session Analysis

M11 begins with **offline capture replay**. The Capture Library now includes **Prepare replay**, **Previous**, and **Next** controls. Load or import a session, prepare a replay, and step through captures in original order. The inspector shows payload hex, byte length, available timestamp, and a session summary with total captures, unique payloads, repeated payloads, and total bytes.

This is **not RF transmission replay**: preparing or navigating a replay does not use WebUSB, change radio settings, or transmit. The current implementation supports manual step-through and optional **timed offline playback** at 0.5×, 1×, 2× or 4×. Missing timestamps use a fallback delay and long gaps are capped; playback never transmits. A session change resets the replay inspector; click Prepare replay again to snapshot the newly loaded captures.

The pure `js/rx/session-replay.js` module validates captures, caps a replay at 10,000 captures and each payload at 4,096 bytes, and computes summary statistics. Unit tests cover ordering, timestamps, repeated payloads, byte formats, and invalid inputs.

## Validation

Run `npm test` and `npm run test:browser`. For manual acceptance, open a saved session containing several captures, prepare replay, navigate to both ends, verify Previous/Next disable correctly, and check the displayed hex against the capture list. Start a new session and confirm the inspector resets. No hardware is needed.

## Timeline and comparison

Preparing replay renders up to 300 numbered timeline markers for direct navigation (the underlying replay can contain more). **Play** and **Pause** control a local timer; Previous, Next, session changes, and timeline navigation stop playback. **Compare sessions** compares the currently prepared replay against a selected saved session, showing per-payload occurrence counts and deltas, capped at 200 displayed rows. Comparisons do not alter the saved session or use the radio.

## Planned expansion

Analysis export and richer graphical timeline remain future increments. Browser acceptance of the new controls has not yet been reported.

## Guided help

Select **Offline capture replay & session comparison** from the welcome wizard or the searchable Help Center. The eight-step tutorial highlights the Capture Library controls, explains offline timing and payload-count comparison, and never starts playback or transmits automatically. Contextual Help topics for replay, speed and comparison link to this guide.
