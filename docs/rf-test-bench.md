# RF Test Bench — Milestone 7 (feature branch)

A controlled RF packet experiment panel. No PR has been opened and no changes have been merged.

## Workflow

1. Connect the YARD Stick One, configure frequency/modulation/packet framing in Radio, and verify that configuration separately.
2. Open **RF Test Bench**. Enter 1–255 bytes of hexadecimal data (spaces, colons, dashes and underscores are accepted).
3. Set 1–20 repetitions and 100–10000 ms spacing. Click **Preview sequence**. Preview does not send RF or change device state.
4. Stop normal Receiver monitoring, Momentum Chat and scanning. Check the explicit authorization checkbox and click **Transmit sequence**; review the confirmation dialog.
5. **Stop after current packet** aborts between packet sends (it cannot interrupt an in-flight USB/firmware transmit).
6. After the run, start Receiver to compare *later* received packet chunks against the expected bytes. Use a separate authorized source for RX. The same YARD Stick One cannot RX during TX.
7. **Export report** saves plan, per-attempt firmware acknowledgements, and up to 100 subsequent RX comparisons.

## Boundaries and safety

- TX uses the **current** radio configuration, does not automatically choose a frequency, and requires a connected device plus authorization confirmation. The transmit routine sets PA power and idles the radio before/after each send. Recheck configuration before each run.
- A firmware TX acknowledgment means the USB/firmware call returned success; it **does not** prove that another device received a valid RF frame.
- RX comparison is an exact byte comparison of the CC1111 packet payload after optional status stripping. Packet boundaries can differ from over-the-air frames. A mismatch is not proof of a protocol error.
- RX comparison is armed after previewed TX begins; it is not a simultaneous TX/RX loopback. Starting another chat or test workflow can invalidate evidence.
- This first iteration has no unattended scheduling, infinite loops, automatic frequency hopping or automated replay of captured traffic. Timing is host-side and includes USB/firmware overhead.

## Manual acceptance checklist

1. Enter malformed hex, odd nibbles and more than 255 bytes; verify preview and send reject them.
2. Enter 21 repeats, 99 ms spacing and 10001 ms spacing; verify validation rejects each.
3. Preview with no radio; confirm it works offline and sends nothing.
4. Confirm Transmit remains disabled until authorization is checked, and cancellation of the confirmation dialog sends nothing.
5. Verify RX/chat/scanning block bench TX, and disconnect blocks TX.
6. On an authorized bench setup, send two harmless test packets, verify per-packet progress, and confirm the radio returns to idle.
7. Test Stop between packets and unplug/reconnect behavior.
8. Start RX and send matching and differing test packets from a separate transmitter. Verify exact-match and differing-byte reporting.
9. Export JSON and inspect the schema, plan, attempts, and comparisons.
10. Check browser console, narrow layout, keyboard navigation and `npm test`.

Unit tests cover parsing, limits, comparisons, execution progress, cancellation and failure. Hardware and browser acceptance are separate.
