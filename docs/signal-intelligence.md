# RF Signal Intelligence (offline)

Signal Intelligence lives in the **Analyze** workspace. It reads an existing **Capture Library** session, groups identical demodulated packet payloads, summarizes frame lengths, and marks byte offsets as fixed or variable within each frame-length cohort. It is intentionally read-only with respect to radio hardware.

![Synthetic offline Signal Intelligence candidate field inference](images/signal-intelligence.png)

*Generated from synthetic packet captures; no RF hardware was used.*

## Workflow

1. Capture packets or import them into a Capture Library session and save it.
2. Expand **Signal Intelligence** in Analyze, choose a saved session and select **Analyze packets**.
3. Review unique and repeated payload counts, length groups, and variable offsets. A changing byte is **not automatically a counter or checksum**.
4. Export JSON, or select **Attach report to session** to preserve the report alongside the original captures in IndexedDB. If captures have changed since analysis, rerun analysis before attaching.
5. Follow the **Offline signal fingerprinting** Help walkthrough for an offline guided tour.

## Interpretation and limitations

The engine does not control the CC1111 or perform TX/RX. It cannot infer modulation or pulse timing from demodulated bytes. It treats protocol names already assigned by a decoder as **unverified labels**, not independently validated matches. It does not claim to identify LRS, JTECH, Momentum, or any other protocol from packet bytes alone. Invalid or empty hexadecimal payloads are reported by original capture index and excluded from statistics. Length cohorts with fewer than two frames cannot establish fixed or changing offsets. Report timestamps are informational.

The candidate field heuristics do not verify field semantics, perform known-profile matching, cluster near-identical payloads, or automatically classify RF waveforms. Those require separate evidence and tests.

## Validation

Run `node --test tests/signal-intelligence.test.js`, `npx playwright test browser-tests/signal-intelligence.spec.js`, then `npm run verify`. Verify empty sessions, duplicate packets, malformed payloads, report persistence, session switching and wizard target visibility. No hardware is required for this phase.

## Quick offline demo

No YARD Stick One is needed. Open the browser console on the application origin and run:

```js
(async () => {
  const {saveCaptureSession} = await import('./js/storage/capture-session-store.js');
  const now = new Date().toISOString();
  await saveCaptureSession({
    id: 'rf-intelligence-demo', name: 'RF Intelligence Demo',
    createdAt: now, updatedAt: now,
    captures: [
      {hex: 'AA0100FF', protocol: 'Demo'},
      {hex: 'AA0101FF', protocol: 'Demo'},
      {hex: 'AA0102FF', protocol: 'Demo'},
      {hex: 'AA0100FF', protocol: 'Demo'}
    ]
  });
})();
```

In **Analyze → Signal Intelligence**, click **Refresh sessions**, select **RF Intelligence Demo**, and click **Analyze packets**. Expect four valid captures, three unique payloads, a four-byte cohort, and variable byte offset 2. Use **Attach report to session** to save the analysis, or **Export JSON** to download it. This sample is synthetic and does not establish protocol identity.

The Signal Intelligence panel is independent of the collapsible RF Signal Analyzer. It should remain visible when the analyzer is closed. The Help Center's **Offline signal fingerprinting** walkthrough is also available as a first-run wizard goal.

## Candidate field inference (experimental)

For each frame-length cohort with at least two packets, the report now includes `fields[].candidates` for variable byte offsets. The browser shows zero-based byte positions, heuristic labels, confidence, scores and caveats. A **candidate counter** requires mostly unit-step transitions across at least four distinct first-seen payloads; a **candidate command/flag** describes a small value domain across at least four unique payloads. Otherwise the byte remains **variable byte** with insufficient evidence. Duplicates are removed for this heuristic, and ordering is not a reliable substitute for a controlled transmission sequence.

These labels are hypotheses, **not** verified device IDs, counters, commands or checksums. No device-ID or checksum detection is claimed. The exported and attached report uses schema version 2 and includes the candidate evidence. Older stored reports remain as previously saved until reanalysis.

Use the **Offline signal fingerprinting** wizard's **Interpret field candidates** step to inspect the new evidence. For a counter-like synthetic test, save `AA00FF`, `AA01FF`, `AA02FF`, `AA03FF`, `AA04FF` in a session, then analyze. Byte offset 1 should be a moderate-confidence candidate counter. For a real device, compare repeated, deliberately controlled transmissions before assigning any field meaning.

## Screenshot and release checklist

Run `npm run verify` and `npm run screenshots:readme` locally after installing Playwright Chromium. Inspect `docs/images/signal-intelligence.png` for the synthetic five-packet candidate-counter example, the zero-based byte offset and the moderate-confidence label. Confirm no real device or captured personal RF traffic appears in the screenshot. Commit the generated PNG after visual review; the screenshot script alone does not commit image files. Then exercise the six-step **Offline signal fingerprinting** wizard and verify report persistence and JSON export.
