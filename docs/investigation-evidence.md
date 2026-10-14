# M23 — Investigation Evidence & Validation Workbench

Open **Analyze → Protocol Definition Builder → Investigation Workspace → Evidence**. Create and save an investigation first. Use **Hypothesis wizard** or **Evidence validation wizard** for contextual Back/Next/Exit guidance; both are also available in Help and onboarding.

1. Define fields in the protocol definition editor. Select a field, hypothesized role (counter, command, device ID, state, checksum, unknown), user-assigned confidence (low/medium/high) and optional notes.
2. Choose a saved Capture Library session and a zero-based capture index, then **Link capture evidence**. Links refer to existing captures; the investigation does not duplicate the source session.
3. **Save hypothesis** to the current investigation. Save/resume the investigation to restore hypotheses; load or delete individual hypotheses independently. Deleting a hypothesis does not delete captures.
4. **Validate across sessions** to inspect per-session decoded matches, contradictions, and whether linked evidence still exists. A missing referenced capture is explicitly marked missing. Counter checks use strictly increasing decoded values (rollovers may be false contradictions); device ID checks require constant values within each session; checksum checks report invalid checksums. Command, state and unknown types only establish decode consistency, not semantics.
5. Export the investigation report to include persisted hypotheses and capture evidence references. Exports may contain sensitive packet bytes. Review before sharing.

**Interpretation:** A report is *insufficient* if fewer than two sessions have matching packets, *contradictory* if the field fails the relevant heuristic or a packet fails decoding, and otherwise *consistent*. These labels are not proof of protocol meaning and are not calibrated probabilities. Confidence is manually assigned. The engine is offline and never sends RF commands.

**Limits:** Up to 100 hypotheses per investigation, 200 distinct capture references per hypothesis, 100 sessions per validation, 10,000 captures per session; reports retain at most 200 decoded observations per session. Use independent recordings rather than repeated frames from the same session when evaluating hypotheses.

## Automated checks

Node tests cover persistence, contradictory and missing evidence, insufficient replication, and invalid references. Playwright tests cover saving a hypothesis, linking capture evidence, validating against saved sessions, SDK decoding, and resuming the investigation after refresh. No hardware is needed.
