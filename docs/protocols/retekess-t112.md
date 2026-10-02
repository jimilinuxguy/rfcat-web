# Retekess T112 Pager 69

**Status: reference implementation; RFCat Web OTA validation pending**

RFCat Web includes the fixed Pager 69 transmission from the published `Retekess_T112_Pager_69.py` reference.

The reference describes Retekess T112 / T1XX signaling as a 24-bit EV1527-style PWM protocol on **433.920 MHz** using ASK/OOK. Its comments describe logical symbols as `1110` for 1 and `1000` for 0, and use a requested RFCat data rate of **3060 baud**, corresponding to approximately 327 µs per transmitted symbol.

The exact reference transmission is:

```text
00 AA 88 8E 8E 8E EE 8E 8E 88 8E 88 88 88 88
```

RFCat Web intentionally reproduces those bytes exactly rather than generalizing pager or restaurant addressing. The source says pager addressing occupies bits 14 through 23 and suggests restaurant addressing may occupy bits 1 through 13, but it explicitly marks that part of the protocol as unresolved.

## RF configuration

```text
Frequency:   433.920 MHz
Modulation:  ASK/OOK
Data rate:   3060 baud
Sync:        disabled
Manchester:  disabled
```

The YARD Stick One amplifier is enabled only around transmission. Repeat count is implemented host-side, with 0 meaning one transmission.

## Source note

The repository README says 5000 baud while the Pager 69 Python script configures 3060 baud and explains 327 µs timing. RFCat Web follows the executable Pager 69 script for this fixed reference implementation.

## Scope

Only the published Pager 69 reference waveform is implemented. RFCat Web does not infer unknown restaurant IDs, enumerate pager IDs, or add an all-pagers activation mode. Use only with equipment and frequencies you own or are explicitly authorized to test.
