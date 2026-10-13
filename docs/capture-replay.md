# RF Capture Replay & Session Analysis

M11 begins with **offline capture replay**. The Capture Library now includes **Prepare replay**, **Previous**, and **Next** controls. Load or import a session, prepare a replay, and step through captures in original order. The inspector shows payload hex, byte length, available timestamp, and a session summary with total captures, unique payloads, repeated payloads, and total bytes.

This is **not RF transmission replay**: preparing or navigating a replay does not use WebUSB, change radio settings, or transmit. The current implementation supports manual step-through and optional **timed offline playback** at 0.5×, 1×, 2× or 4×. Missing timestamps use a fallback delay and long gaps are capped; playback never transmits. A session change resets the replay inspector; click Prepare replay again to snapshot the newly loaded captures.

The pure `js/rx/session-replay.js` module validates captures, caps a replay at 10,000 captures and each payload at 4,096 bytes, and computes summary statistics. Unit tests cover ordering, timestamps, repeated payloads, byte formats, and invalid inputs.

## Validation

Run `npm test` and `npm run test:browser`. For manual acceptance, open a saved session containing several captures, prepare replay, navigate to both ends, verify Previous/Next disable correctly, and check the displayed hex against the capture list. Start a new session and confirm the inspector resets. No hardware is needed.

## Timeline and comparison

Preparing replay renders up to 300 numbered timeline markers for direct navigation (the underlying replay can contain more). **Play** and **Pause** control a local timer; Previous, Next, session changes, and timeline navigation stop playback. **Compare sessions** compares the currently prepared replay against a selected saved session, showing per-payload occurrence counts and deltas, capped at 200 displayed rows. Comparisons do not alter the saved session or use the radio.

## Planned expansion

A richer graphical timeline remains a potential future enhancement. JSON/CSV analysis export is available. The user reported passing Node and Playwright tests, including the four replay browser acceptance tests, on October 13, 2026. CI status and physical hardware behavior have not been independently verified.

## Guided help

Select **Offline capture replay & session comparison** from the welcome wizard or the searchable Help Center. The eight-step tutorial highlights the Capture Library controls, explains offline timing and payload-count comparison, and never starts playback or transmits automatically. Contextual Help topics for replay, speed and comparison link to this guide.

## Automated browser acceptance

`browser-tests/m11.spec.js` adds four Playwright acceptance tests using imported synthetic capture JSON: replay navigation and reset, timed playback with speed/pause, comparison against an IndexedDB-saved session, and all eight Help-tour targets plus exit. The tests run without USB hardware. Run `npm run test:browser` or `npx playwright test browser-tests/m11.spec.js`. The existing browser regression suite also iterates all registered tours. The user confirmed these tests passed locally on October 13, 2026; CI and physical hardware validation are separate.

## Report export

After **Prepare replay**, choose **Export replay JSON** or **Export replay CSV**. Both download offline reports with capture hex, length, timestamps, RSSI and decoder metadata. If you have compared a saved session, the report also includes every per-payload count and delta (including rows beyond the 200 shown on screen). JSON includes summary statistics and comparison session metadata. Export never transmits or modifies saved captures. Run `npm run verify` locally for Node and browser regression tests; no paid CI is required.

## Controller organization

The browser replay UI and playback/compare event wiring now live in `js/ui/replay-controller.js`, initialized by `app.js` with capture and session callbacks. Report formatting is isolated in `js/rx/replay-report.js` and downloads in `js/ui/replay-export.js`. This is a targeted extraction, not a rewrite of the receiver. Browser and Help selector tests cover the module move. The new extraction should be revalidated locally before merging.
