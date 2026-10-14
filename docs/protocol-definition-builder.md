# M13 — Protocol Definition Builder

Open **Analyze → Protocol Definition Builder**. This hardware-free workbench converts packet-field hypotheses into reusable, versioned, declarative protocol definitions. It does **not** register a transmitter or reconfigure RF hardware.

## Visual field editor (M14)

Select an offset in the byte map, then enter the field name, width and type. Assigned offsets are underlined. Choose an existing field from the dropdown to edit or remove it. Additional controls configure endian order, bit offsets and widths, enum labels, and checksum algorithms and ranges. The editor updates the JSON draft; use **Validate and save** to persist. Overlapping and invalid fields are rejected. Advanced JSON editing remains available and refreshes the map.

## Workflow

1. Enter a unique definition ID, display name, expected packet length, optional hex prefix (the prefix must be present in the captured packet bytes), optional frequency in Hz, and a descriptive modulation label.
2. Edit the **Fields JSON** array. Each field has a name, zero-based start byte and width, and one of `hex`, `uint`, `bits`, `enum`, `checksum`. `uint` supports 1–6 bytes and `endian` of `big` or `little`. `bits` uses `bitOffset` (MSB-first, within the selected byte range) and `bitWidth`. `enum` maps decimal numeric strings to display labels. One-byte checksums support `xor8`, `sum8`, and `sum8-twos-complement` with inclusive `checksumStart` and `checksumEnd` input ranges before the checksum byte.
3. Select **Validate and save** to store the definition in IndexedDB. The library supports Load, Delete, JSON Export and JSON Import. Import validates schema but only persists after you explicitly save.
4. Choose a Capture Library session and **Validate against session** to see matched frame counts, match rate, checksum failures and per-packet results. **Decode packet** tests a hex packet without hardware.
5. To promote M12 annotations, select a session and annotated frame length, choose **Preview annotations**, review the types and offsets, then **Confirm promotion into editor**. This only copies the draft to the editor; it does not automatically save or validate field meanings.

## Example

```json
{
  "schemaVersion": 1,
  "id": "demo_sensor",
  "name": "Demo sensor",
  "packetLength": 3,
  "sync": "AA",
  "frequencyHz": 433920000,
  "modulation": "OOK",
  "fields": [
    {"name":"counter","start":1,"width":1,"type":"uint","endian":"big"},
    {"name":"payload","start":2,"width":1,"type":"hex"}
  ]
}
```

## Live RX matching

Saved definitions are loaded into an in-memory cache when the page starts. Newly saved or deleted definitions refresh the cache. Incoming Receiver captures are matched passively by packet length and optional prefix; matching definitions are displayed as **Custom protocol hypothesis** beside existing decode output. Existing protocol decoders, receive filtering, and RF configuration are unchanged. A matching prefix is not proof of protocol identity; multiple definitions can match the same packet. The optional frequency and modulation labels are documentation metadata, **not** validated against hardware register state or capture context.

## Constraints and safety

Definition IDs must be unique within the local library. Byte ranges must fit within the declared frame and must not overlap. Checksum verification does not currently prevent a length/prefix match; failures are explicitly reported. The schema intentionally rejects executable JavaScript, custom code and unsupported CRC algorithms. All data stays in browser-local IndexedDB unless explicitly exported. Browser storage is origin-specific and may be cleared by the browser.

The builder operates on bytes already delivered by the receiver's packet engine; it cannot recover missing RF symbols, infer modulation, or establish frame boundaries. **Definition fields and checksum matches are hypotheses** until validated against independently collected signals. For hardware-free regression testing, run `node --test tests/protocol-definitions.test.js` and `npm run verify`.
