# POCSAG Reference / Inspector

**Status: analysis only, non-transmitting**

RFCat Web includes a small POCSAG reference module for protocol research,
capture inspection, and interoperability work on authorized systems.

It intentionally does not configure the radio or transmit pager messages.

## Reference framing

The module records the common POCSAG framing constants:

```text
Preamble:        576 alternating bits
Sync codeword:   0x7CD215D8
Idle codeword:   0x7A89C197
Batch:           16 x 32-bit codewords
```

The inspector accepts a 32-bit hexadecimal word and displays its bit
representation, high-level address/message classification, and even-parity
state.

## JTECH reference script

The public `jtech_pager/activate_all.py` research script uses 512 baud
2-FSK and explicitly places an inverted representation of the normal POCSAG
sync pattern in its transmitted bitstream. Its hard-coded pager bit strings
are useful as historical/reference captures, but RFCat Web does not expose
the script's mass-page behavior.

The reference script also requests a 4.5 kHz deviation. That value is
documented as a property of that script, not as a universal JTECH setting.

## Scope

This module is intended for inspecting captures and understanding framing.
It does not scan for paging systems, enumerate pager addresses, brute-force
capcodes, or provide an RF transmit path.
