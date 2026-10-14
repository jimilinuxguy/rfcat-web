# Packet Field Editor (experimental)

Open **Analyze → Signal Intelligence**, select a Capture Library session, and choose **Analyze packets**. The **Packet field editor** displays a hex-byte comparison grid for same-length frames. Bold bytes vary between displayed packets. Select a byte to populate the starting offset, choose a width, name and tentative interpretation, then add an annotation. Overlapping annotations are rejected. Remove annotations with the corresponding Remove button.

**Attach report to session** persists both the intelligence report and the field annotations to IndexedDB. Export annotations as JSON separately. The original capture bytes are never modified. Annotations are user hypotheses, not independently verified device IDs, counters, commands or checksums.

The grid shows up to 30 captures for readability; annotation value summaries use all valid packets in the selected length cohort. Different frame lengths have separate annotations. To validate offline run `node --test tests/packet-field-editor.test.js` and `npm run verify`. Hardware is not required.

## Guided walkthrough and screenshot

Open **? Help → Packet field annotation workbench** for a guided tour. Regenerate the synthetic screenshot with `npm run screenshots:readme`; the generator writes `docs/images/packet-field-editor.png`. Review the image and commit it before adding Markdown image links.
