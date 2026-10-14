# Packet Field Editor (experimental)

Open **Analyze → Signal Intelligence**, select a Capture Library session, and choose **Analyze packets**. The **Packet field editor** displays a hex-byte comparison grid for same-length frames. Bold bytes vary between displayed packets. Select a byte to populate the starting offset, choose a width, name and tentative interpretation, then add an annotation. Overlapping annotations are rejected. Remove annotations with the corresponding Remove button.

**Attach report to session** persists both the intelligence report and the field annotations to IndexedDB. Export annotations as JSON separately. The original capture bytes are never modified. Annotations are user hypotheses, not independently verified device IDs, counters, commands or checksums.

The grid shows up to 30 captures for readability; annotation value summaries use all valid packets in the selected length cohort. Different frame lengths have separate annotations. To validate offline run `node --test tests/packet-field-editor.test.js` and `npm run verify`. Hardware is not required.

## Guided walkthrough and screenshot

Open **? Help → Packet field annotation workbench** for a guided tour. Regenerate the synthetic screenshot with `npm run screenshots:readme`; the generator writes `docs/images/packet-field-editor.png`. Review the image and commit it before adding Markdown image links.

## Advanced field inference (experimental)

The editor automatically examines each same-length packet cohort and lists **candidate** multi-byte counters (2–4 bytes, both big- and little-endian), byte-level changing-bit masks, and trailing XOR-8, additive-8, and two's-complement additive-8 checksums. Candidates show offsets, a bounded heuristic score, a confidence label, and the observed evidence. These are exploratory hints only, **not** verified protocol semantics. The inference never changes packets or silently creates field annotations.

Inference requires at least three valid same-length packets. Counter candidates require at least three distinct values and a largely consistent nonzero step across capture order; capture order must therefore reflect transmission order. A changing-bit mask only describes which bits varied, not whether they are flags. Checksum tests cover **all bytes before the final byte** and require changing payloads and changing checksum values. Other checksum placements, initial seeds, CRCs, scrambled/encoded data, and skipped headers are not tested. Repeated or correlated synthetic packets can create false positives. Scores are heuristic, not calibrated probabilities; independently validate candidates with additional captures and controlled field changes.

Run `node --test tests/advanced-field-inference.test.js` and `npm run verify` to validate. All analysis runs locally without a radio or network connection.
