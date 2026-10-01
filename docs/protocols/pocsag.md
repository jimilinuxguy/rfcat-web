# POCSAG Pager

**Status: implemented and synthetically tested; OTA/device interoperability not yet validated**

RFCat Web includes both a POCSAG transmitter and a non-transmitting reference/inspector for authorized paging-system development and interoperability testing.

## Transmitter

The transmitter builds a standard address-only POCSAG alert from an explicit capcode and function value. It does not discover, enumerate, or sweep capcodes.

Implemented framing:

```text
Preamble:        576 alternating bits
Sync codeword:   0x7CD215D8
Batch:           16 x 32-bit codewords
Idle codeword:   0x7A89C197
Address BCH:     BCH(31,21), generator 0x769
Parity:          even
Rates:           512 / 1200 / 2400 baud
```

The capcode's low three bits select one of eight frames. The address codeword is placed in the first codeword position of that frame and the remaining positions are filled with idle codewords.

Current TX support is deliberately limited to address/function alerts. Numeric and alphanumeric message codewords are not yet implemented.

## RF configuration

Generic POCSAG exposes frequency, baud rate, deviation, function, polarity, RFCat repeat, and offset.

The **JTECH reference RF settings** profile is based on the public `jtech_pager/activate_all.py` research script. That script configures:

```text
2-FSK
512 baud
4.5 kHz requested deviation
hardware sync disabled
```

Its example frequency is 457.600 MHz, but the script accepts frequency as a command-line argument. RFCat Web therefore keeps frequency explicit rather than treating 457.600 MHz as universal.

The 4.5 kHz deviation is likewise a reference-script setting, not a claim that every JTECH model or installation uses that deviation.

## Polarity and the JTECH reference

Normal POCSAG sync is:

```text
0x7CD215D8
01111100110100100001010111011000
```

The JTECH reference script places the complementary sync bit pattern in its raw stream:

```text
0x832DEA27
10000011001011011110101000100111
```

RFCat Web therefore provides an explicit **Invert transmitted polarity** option. Inversion applies to the complete generated POCSAG stream.

The reference script also contains hard-coded 40-bit pager strings for capcodes 79984 and 79992. Those strings are not treated as ordinary 32-bit POCSAG codewords here. Their extra framing/alignment should be understood and captured independently before adding a compatibility encoder for them.

## Reference / Inspector

The separate **POCSAG Reference / Inspector** remains non-transmitting. It can inspect a 32-bit hexadecimal word, display its bits, classify its high-level address/message form, report even parity, and show normal or inverted representation.

## Validation

Automated tests cover:

- standard sync, idle, and preamble constants
- BCH/parity address generation
- capcode-to-frame placement
- complete one-batch frame length
- inverted sync/polarity
- capcode and function validation

Hardware validation is still required. Before marking this OTA validated, capture a YARD Stick One transmission with an independent SDR and compare bit rate, polarity, deviation, preamble, sync, and generated address codeword.

## Scope

Use the transmitter only with paging equipment and frequencies you own or are explicitly authorized to test. The implementation requires an explicit capcode and does not include scanning, capcode enumeration, brute force, or mass-page workflows.
