# Retekess restaurant pagers

**Status: source-derived implementations; OTA validation pending**

RFCat Web keeps the documented Retekess families separate because model numbers use different RF modulation, timing and frame layouts. Retekess hardware can also exist in different protocol revisions under the same model name.

## T112

The BayCom RPS implementation resolves the T112 payload as 24 bits, LSB-first:

- 13-bit system ID
- 10-bit pager number
- 1-bit cancel flag

OOK at 433.920 MHz. A frame uses a 220 µs high / ~6.49 ms low sync, then 24 data symbols. Zero is 330/990 µs high/low and one is 990/330 µs. RPS repeats the 349-sample frame 12 times. RFCat Web exposes system ID, pager ID, cancel and frame count.

The earlier published RFCat Pager 69 script is consistent with approximately 3.03 kbit/s T112 timing, but only supplied one fixed capture.

## TD161

BayCom documents TD161 as 433.920 MHz OOK at 5000 symbols/s. The frame contains BCD pager ID, function, BCD system ID and trailing zero nibbles. Logical zero is 1000 and one is 1110. The implementation repeats the frame 30 times.

RFCat Web exposes only an explicit system ID, pager ID and documented function value.

## TD164

BayCom documents TD164 as 433.920 MHz 2-FSK at 10 kbit/s. It uses ten 0xAA bytes, preamble 0x12340205, a sequence nibble, separator 9, function, three BCD pager digits, two checksum nibbles and five zero bytes. RPS repeats the frame 20 times.

RFCat Web exposes pager ID, sequence and the documented page/program/mute-control function codes. OTA validation will determine the best CC1111 deviation for the tested hardware.

## T119 and TD165

Pagger documents both as 24-bit 433.920 MHz OOK formats with a 13-bit station, 10-bit pager and 1-bit action. Fields are bit-reversed. Its Flipper key representation uses Princeton framing with TE 271 µs.

RFCat Web supports a single explicit station/pager/action tuple. It does not implement Pagger's range/brute-force generator or special fleet-wide command helpers.

## TD157

Pagger documents TD157 at 433.920 MHz OOK with 10 station bits, 10 pager bits and a four-bit action field. Its normal single-pager call uses action 0010 and Princeton TE 212 µs. RFCat Web exposes explicit station and pager values and fixes the action to the documented normal-page value.

## TD174

Pagger documents TD174 at 433.889 MHz OOK using an SMC5326-style 25-bit representation with TE 326 µs. The decoded fields are a 13-bit station, two action bits and eight pager bits. RFCat Web implements the normal page action only.

## Scope and validation

These implementations are intended for explicit, known system/pager identifiers on equipment you own or are authorized to test. They intentionally omit station/pager enumeration, brute-force generation, all-pager helpers and desynchronization workflows.

Run the automated regression tests first, then validate one known pager at a time over the air. Record the exact model/revision, configured frequency, observed action and any required CC1111 timing/deviation adjustment before marking a protocol OTA validated.
