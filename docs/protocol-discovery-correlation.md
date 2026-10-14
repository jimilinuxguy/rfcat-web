# M25–M26: Protocol Candidate Discovery and Session Correlation

Open **Analyze → Protocol Definition Builder → Investigation Workspace → Discovery**. These features operate on saved Capture Library sessions, entirely offline.

## M25 — Candidate discovery

1. Select one or more saved sessions using the checkboxes in **Candidate Discovery**.
2. Click **Discover candidates**. The engine groups valid complete hexadecimal packets by length, ranks the layouts using sample coverage, independent-session coverage and constant-prefix length, and marks byte positions as constant, variable, counter-candidate or session-identifier candidates.
3. Choose a candidate to inspect its byte-by-byte comparison table, or click **Compare candidates** to inspect alternative packet lengths, fields and warnings.
4. Save an investigation, then click **Save candidate review** to persist selected candidate definitions, warnings and source-session references in IndexedDB.
5. Click **Promote to definition draft** to copy the candidate into the Protocol Definition Builder. This **does not automatically save a protocol**. Review offsets, field types and meanings before saving it explicitly.

## M26 — Multi-session correlation

Choose recordings made during different device actions, then click **Correlate sessions**. The report compares byte values and their distinct counts across sessions and highlights bytes that remain stable within a session but differ between sessions. It does not assume those bytes represent device identifiers, commands or verified protocol fields.

A recommended experiment uses Session A (button 1), B (button 2), C (button 1 again), and D (a different device), if legally captured. Compare observations, not just ranking scores.

## Limitations and safety

The analysis is **byte-aligned**, not bit-level protocol discovery. It does not infer modulation, symbol timing, encoding, encryption, CRC polynomials, true synchronization or packet boundaries from raw IQ. It assumes the capture sessions already contain framed packet hex. Scores are relative heuristic rankings, **not probabilities**. An apparent counter requires monotonic increments in capture order; wraparound and dropped frames can distort the result. At most 100 sessions, 10,000 captures per session and 20 ranked candidates are processed. No WebUSB or RF transmission is performed.

The persisted review stores a compact set of candidate definitions and references, not duplicated capture data. After resuming an investigation, click **Discover candidates** to recompute from current source sessions before promoting.

## Guided walkthroughs and testing

Launch **Candidate discovery wizard** or **Session correlation wizard** from the central Help Center or welcome onboarding. The existing tour engine provides Back/Next/Exit and highlights controls; it never changes stored data or triggers analysis on its own.

Unit tests: `tests/protocol-candidate-discovery.test.js`. Browser tests: `browser-tests/m25-m26.spec.js` and `browser-tests/m25-m26-help.spec.js`. Tests use synthetic sessions and require no hardware.
