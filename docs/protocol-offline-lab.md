# M27–M30: Offline Protocol Lab

Open **Analyze → Protocol Definition Builder → Investigation Workspace**. The **Simulation**, **Synthetic**, **Differential** and **Dashboard** stages point to the Offline Protocol Lab, which is also accessible directly below the investigation controls. All four features work with synthetic or saved packet data in the browser, with **no WebUSB, radio, or RF transmission**.

## M27 — Deterministic capture replay and simulation

Select a saved capture session and a registered trusted decoder adapter. Click **Load simulation** to decode packets in original capture order. Use **Step**, **Back**, **Reset**, **Play** and **Pause**, with 0.5×–4× UI playback speed. Optional field/value breakpoints pause playback after a matching decoded packet. These speeds are *simulation pacing*, not recovered RF timing. The simulation engine returns per-frame decoded fields, match status, failure reason and breakpoint indices.

## M28 — Synthetic packet generator

Select a protocol definition in the editor, choose an integer seed and count (1–1000), then click **Generate synthetic packets**. Repeating a seed and definition reproduces identical bytes. Optional mutation flips first/last bytes or truncates packets, supporting negative decoder tests. Click **Simulate generated packets** to send them through the offline decoder path. The generator supports sync bytes, numeric fields and declared checksums; other bytes are seeded test data, not authentic device messages. Mutations do not imply protocol validity.

## M29 — Differential analysis

Choose a capture session, comparison protocol definition and trusted decoder adapters. Click **Compare identical packets**. The report lists per-packet changes in matched status or decoded field values, and total changed interpretations. Identical results do not establish protocol correctness. To compare adapter versions, register reviewed adapters through the [M24 Decoder SDK](protocol-decoder-sdk.md).

## M30 — Evidence dashboard

Click **Calculate evidence summary** to aggregate matched packets and totals across saved capture sessions using the current definition. When an investigation is saved, the dashboard also counts field hypotheses, evidence references, missing references, candidate reviews and unresolved questions. Coverage is decoder matching rate, **not** a statistical confidence estimate. Use **Save lab snapshot** to persist bounded summary metrics in the investigation; **Export lab report** downloads JSON. Reloading a saved investigation restores its snapshot, not a live recomputation.

## Guided wizards and tests

Four contextual tours are available in the Investigation Workspace, Help Center and welcome onboarding: **Simulation wizard**, **Synthetic packets wizard**, **Differential analysis wizard**, **Evidence dashboard wizard**. Each uses highlighted targets, Back/Next/Exit and never starts hardware operations.

- Unit coverage: `tests/protocol-offline-lab.test.js`
- Browser workflow: `browser-tests/m27-m30.spec.js`
- Browser guided tours: `browser-tests/m27-m30-help.spec.js`

Run `npm test` and `npm run test:browser` per the repository package scripts. All fixtures are offline. The simulator processes up to 10,000 packets per run and the synthetic generator up to 1,000 per batch.

**Security:** Registered decoder adapters are trusted application code, not sandboxed untrusted plugins. Review modules before bundling them. Reports and captures may contain sensitive RF packet contents; inspect exports before sharing.
