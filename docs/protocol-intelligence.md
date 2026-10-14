# M31–M34: Offline Protocol Investigation Intelligence

Open **Analyze → Protocol Definition Builder → Investigation Workspace → Pipeline / Bits / CRC / Clusters**. The **M31–M34 Investigation Intelligence** panel appears below the investigation controls. Everything runs locally against saved framed hexadecimal captures; no RF device, network service, Python or transmission is needed.

## M31 — Automated investigation pipeline

Select one or more saved Capture Library sessions and click **Run investigation pipeline**. This combines M25 packet-length candidate discovery, M26 cross-session byte correlation, M32 bit variability, M33 trailing checksum candidates and M34 Hamming-distance clustering. If the current protocol draft is valid, it also includes M30 decoder coverage and evidence statistics. Inspect the summary, tabular visualization and full JSON. The report retains source-session references and explicit unresolved questions. Save an investigation first, then **Save investigation analysis** to store a bounded snapshot in IndexedDB. **Export analysis JSON** saves a portable report. Resuming restores the snapshot; rerun to update against changed sessions.

## M32 — Bit-level protocol analysis

Click **Analyze bit fields**. Packets are grouped by byte length; each bit is numbered MSB-first from offset zero. The engine reports zero/one counts, constant/variable/session-dependent classification, per-byte variability masks and adjacent-capture Hamming-distance summaries. It does not discover RF symbol timing or establish semantic field boundaries. At most 100 sessions and 10,000 packets per packet-length cohort are examined. Session-dependent bits are not automatically device IDs.

## M33 — Checksum and CRC candidate discovery

Click **Discover checksums** to test the final byte(s) of framed packets against XOR-8, SUM-8, SUM-8 two's-complement, CRC-8, CRC-8/MAXIM, CRC-8/SAE-J1850, CRC-16/CCITT-FALSE, CRC-16/XMODEM and CRC-16/ARC presets. All candidates use the preceding full bytes as input and compare an 8-bit final byte or a big-endian 16-bit trailer. Results include match counts, total samples and independent-session coverage, sorted by evidence. This is a **bounded preset search, not exhaustive CRC reverse engineering**. Coincidental matches are possible. The current protocol-definition schema supports only the three 8-bit checksum algorithms; CRC-16 matches remain suggestions and cannot be promoted as supported checksums without extending that schema.

## M34 — Protocol relationship and clustering explorer

Set a maximum bitwise **Cluster distance** and click **Cluster captures**. A deterministic greedy algorithm compares each packet to the first-seen representative of existing same-length groups. Results include representative packet hex, packet count, source-session membership and linked capture indices. Different packet order or distance thresholds can change the groups. Similarity does not prove a shared device, vendor or protocol. At most 2,000 packets are clustered per run.

## Guided Help and screenshots

Four guided wizards—**Investigation pipeline**, **Bit analysis**, **CRC discovery**, and **Clustering**—are available from the Investigation Workspace, Help Center and first-run onboarding. Each offers highlighted controls, Back/Next/Exit and no automatic writes. Reproducible offline screenshots can be generated with `npm run screenshots:intelligence`; see `docs/images/protocol-intelligence-*.png` after generation. The screenshot script seeds synthetic captures, exercises all four engines and takes panel screenshots without hardware.

## Tests and safety

Unit fixtures: `tests/protocol-intelligence.test.js`. End-to-end Playwright: `browser-tests/m31-m34.spec.js`. Tour navigation: `browser-tests/m31-m34-help.spec.js`. Screenshot generation: `tools/intelligence-screenshots.mjs`. Run `npm test`, `npm run test:browser`, and `npm run screenshots:intelligence`. All synthetic packets are non-transmitting. Reports may contain captured RF packet data; review before sharing.
