# Retekess restaurant pagers

**Status: source-derived TX/RX implementations; OTA validation pending**

RFCat Web keeps the documented Retekess families separate because model numbers use different RF modulation, timing and frame layouts. Retekess hardware can also exist in different protocol revisions under the same model name.

## T112

The BayCom RPS implementation resolves the T112 payload as 24 bits, LSB-first:

- 13-bit system ID
- 10-bit pager number
- 1-bit cancel flag

OOK at 433.920 MHz. A frame uses a 220 µs high / ~6.49 ms low sync, then 24 data symbols. Zero is 330/990 µs high/low and one is 990/330 µs. RPS repeats the 349-sample frame 12 times. RFCat Web exposes system ID, pager ID, cancel and frame count, and can transmit a user-selected sequential pager range within the configured system. No separate T112 all-pagers address is asserted by the sources used here.

The earlier published RFCat Pager 69 script is consistent with approximately 3.03 kbit/s T112 timing, but only supplied one fixed capture.

## TD161

BayCom documents TD161 as 433.920 MHz OOK at 5000 symbols/s. The frame contains BCD pager ID, function, BCD system ID and trailing zero nibbles. Logical zero is 1000 and one is 1110. The implementation repeats the frame 30 times.

RFCat Web supports an explicit system ID and pager ID, a sequential pager range within that system, and the documented pager 999 all-pagers paging command.

## TD164

BayCom documents TD164 as 433.920 MHz 2-FSK at 10 kbit/s. It uses ten 0xAA bytes, preamble 0x12340205, a sequence nibble, separator 9, function, three BCD pager digits, two checksum nibbles and five zero bytes. RPS repeats the frame 20 times.

RFCat Web exposes pager ID, sequence and the documented page/program/mute-control function codes, and can transmit a user-selected sequential pager range. No separate TD164 broadcast address is asserted by the sources used here. OTA validation will determine the best CC1111 deviation for the tested hardware.

## T119 and TD165

Pagger documents both as 24-bit 433.920 MHz OOK formats with a 13-bit station, 10-bit pager and 1-bit action. Fields are bit-reversed. Its Flipper key representation uses Princeton framing with TE 271 µs.

RFCat Web supports a single explicit station/pager/action tuple, a user-selected sequential pager range within that station, and the documented pager 1005 all-pagers command.

## TD157

Pagger documents TD157 at 433.920 MHz OOK with 10 station bits, 10 pager bits and a four-bit action field. Its normal single-pager call uses action 0010 and Princeton TE 212 µs. RFCat Web exposes explicit station and pager values, supports a user-selected sequential range, fixes normal single/sequential paging to action 0010, and exposes the documented all-pagers command using pager 999 with action 1111.

## TD174

Pagger documents TD174 at 433.889 MHz OOK using an SMC5326-style 25-bit representation with TE 326 µs. The decoded fields are a 13-bit station, two action bits and eight pager bits. RFCat Web implements the normal page action and supports a user-selected sequential pager range. No separate TD174 all-pagers command is asserted by the sources used here.

## Receive / sniffing support

The Retekess protocol modules also provide passive RX decoders for T112, T119, TD157, TD161, TD164, TD165 and TD174. They participate in RFCat Web's protocol-specific and Auto decode modes.

OOK decoders search across bit alignment rather than requiring the frame to begin at byte offset zero. T112 validates its sync and 24 data symbols. TD161 validates the BCD fields, documented function range and trailing low symbols. The T119/TD157/TD165/TD174 family decoders recover their documented station, pager and action fields. TD164 detects its preamble and validates both checksum nibbles before reporting a frame.

These decoders are synthetically tested by encoding known frames and decoding the resulting byte stream. They are not yet OTA validated against captures from physical Retekess transmitters.

## Scope and validation

These implementations are intended for known systems on equipment you own or are authorized to test. Each supported model can page one explicit pager or page a user-selected sequential range within the configured station/system. Where the source documents a protocol-defined all-pagers command, RFCat Web exposes that command directly. It does not search or enumerate unknown station/system IDs.

Run the automated regression tests first, then validate one known pager at a time over the air. Record the exact model/revision, configured frequency, observed action and any required CC1111 timing/deviation adjustment before marking a protocol OTA validated.
