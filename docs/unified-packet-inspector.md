# Packet Inspector (M39)

The Packet Inspector is an offline, read-only packet viewer. Open **Inspect packet** from the Investigation Workspace's saved capture selection. Choose a packet index and optionally a second index for comparison.

Hex bytes and printable ASCII share offsets. Select a byte to view its hex, ASCII and bit representation. Bit display order changes presentation only, never the stored bytes. MSB-first displays bit 7 first, LSB-first displays bit 0 first.

A selected compatible protocol definition exposes decoded fields and their byte/bit ranges. Unmatched packets and invalid definitions report errors instead of assigning speculative meanings. The existing packet comparison engine supplies offset-aligned differences for supported packets. Annotations remain local to the inspector until explicitly exported.

**Export report** downloads versioned JSON with observed hex, available packet metadata and user annotations. Nothing is transmitted, flashed or persisted automatically. The inspector does not change saved captures.

Limitations: entry is currently available from the Investigation Workspace's selected saved session. Live receiver and import entry points, full keyboard range selection, and dedicated browser regression coverage remain follow-up work. Run `node --test tests/packet-inspector.test.js` and `npm run verify` to validate.
