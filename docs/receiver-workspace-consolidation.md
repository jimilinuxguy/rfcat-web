# M40 — Receiver workspace consolidation

The Receive workspace prioritizes live packet capture. The Receiver keeps the listening controls, decoder/filter selection, capture actions, status counters and live packet list immediately accessible.

The **Specialized receivers** section contains the POCSAG preset. **Receiver diagnostics** contains burst grouping. Both start collapsed. The **Capture Library** appears after the packet list and starts collapsed. These sections remember open/closed preferences in localStorage under `rfcat.receiver.disclosure.v1`.

Existing control IDs and event handlers are preserved. Radio configuration remains in its separate Tools workspace panel, and analysis workflows remain available without adding more nested navigation.

## Manual verification

1. Open Receive; confirm the live capture list is above the Capture Library and that secondary sections start collapsed on first visit.
2. Expand POCSAG, diagnostics and library; reload; confirm disclosure preferences persist.
3. Import a saved RX JSON fixture, use Compare and Infer Fields, then save and reopen a Capture Library session.
4. Verify Start listening, Clear, POCSAG RX, burst tracking and all radio controls still behave as before when hardware is available.
5. Check narrow viewport and browser zoom for clipping and keyboard access.

Run `npm test`, `npm run test:browser`, and `npm run verify` locally. These have not been executed by the GitHub connector.
