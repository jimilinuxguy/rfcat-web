# Investigation workflow and packet validation

The **Investigation Workspace** is organized around four primary steps: **Evidence → Discover → Validate → Results**. Select a saved Capture Library session and save an investigation to retain findings. The specialist stage navigation is available under **Advanced analysis tools**, rather than crowding the primary workflow.

## Compare packets

Under **Investigate packets → Compare packets**, enter 2–24 capture indices, for example `0,1,2`, and click **Compare selected packets**. Changed bytes are highlighted in a compact scrollable grid. Hover over cells for byte offsets and changed bit positions. The detailed report includes per-byte values, XOR summaries, pairwise Hamming distances, and optional labeled byte-region annotations. It is observational, not proof of counter or device-ID semantics.

## Find patterns

Choose **Find patterns → Analyze selected session**. The hypothesis engine combines MSB-first bit variability, session correlation and trailing checksum candidate matches. Each candidate includes its supporting examples, contradictions or unmatched counts, and a cautious explanation. Confidence labels are exploratory rather than calibrated probabilities. Single-session results cannot establish device-specific identifiers across sessions.

## Validate decoder

Choose **Validate decoder**. Select a packet index, choose whether the packet should match or be rejected, and **Add test case**. Click **Run validation** to execute the trusted declarative decoder against each expectation. The report includes passed/failed assertions and mismatched expected fields. The underlying validation engine supports expected field values; the initial UI focuses on positive and negative match assertions. Save findings to persist the corpus with the investigation. These tests do not send RF.

## Saving, exporting and Help

**Save findings** requires a saved investigation and stores a bounded local snapshot. **Export findings** downloads JSON containing comparisons, annotations, hypotheses or test expectations. Snapshots are restored when resuming the investigation; rerun analyses when captures change. Full report JSON is under a collapsed **Detailed analysis** disclosure. Four illustrated guided walkthroughs are available exclusively from the central **(?) Help** menu, not inline in the workspace.

## Screenshots and regression tests

Run `npm run screenshots:workflow` to capture reproducible browser screenshots for comparison, pattern analysis, validation and workflow navigation, using synthetic offline captures. The resulting PNGs are available under `docs/images/investigation-workflow-*.png`. The Node test suite includes `tests/protocol-workflow.test.js`; browser coverage includes `browser-tests/m35-m38.spec.js` and `browser-tests/m35-m38-help.spec.js`.

All tools are offline. Packet data and exported reports may be sensitive; inspect before sharing.
