# Retekess restaurant pagers

**Status: T112, T119, TD157, TD161, TD164, TD165 and TD174 TX/RX OTA validated with YARD Stick One hardware**

RFCat Web keeps the documented Retekess families separate because model numbers use different modulation, timing and frame layouts. Retekess hardware may also exist in different protocol revisions under the same model name, so the values below describe the implementations and hardware revisions actually tested.

## Validation summary

| Model | RF / modulation | TX timing | Validated RX | TX | RX |
| --- | --- | --- | --- | --- | --- |
| T112 | 433.920 MHz OOK | ~330 µs base data pulse | 9090.909 samples/s raw OOK | OTA | OTA |
| T119 | 433.920 MHz OOK | TE 271 µs | 14760.1476 samples/s, 4× | OTA | OTA |
| TD157 | 433.920 MHz OOK | TE 212 µs | 18867.9245 samples/s, 4× | OTA | OTA |
| TD161 | 433.920 MHz OOK | 5000 symbols/s | 5000 samples/s raw OOK | OTA | OTA |
| TD164 | 433.920 MHz 2-FSK | 10 kbit/s | 10 kbit/s, 15 kHz requested deviation | OTA | OTA |
| TD165 | 433.920 MHz OOK | TE 271 µs | 14760.1476 samples/s, 4× | OTA | OTA |
| TD174 | 433.889 MHz OOK | TE 326 µs | 12269.9387 samples/s, 4× | OTA | OTA |

All models also have synthetic encode/decode regression coverage. The OTA status means the RFCat Web implementation was exercised over the air with YARD Stick One hardware and the corresponding receiver decoded the transmitted addressing fields. It does not imply every hardware revision sold under a model number is identical.

## T112

The BayCom RPS implementation resolves the T112 payload as 24 bits, LSB-first:

- 13-bit system ID
- 10-bit pager number
- 1-bit cancel flag

T112 uses OOK at 433.920 MHz. A frame uses a 220 µs HIGH / approximately 6.49 ms LOW sync, then 24 data symbols. Logical zero is approximately 330/990 µs HIGH/LOW and logical one is approximately 990/330 µs. The documented frame is 349 base samples and is repeated 12 times.

RFCat Web exposes system ID, pager ID, cancel and frame count and can transmit a selected sequential pager range within the configured system. No separate T112 all-pagers address is asserted by the sources used for this implementation.

The earlier published RFCat Pager 69 script is consistent with approximately 3.03 kbit/s T112 timing but supplied only one fixed capture.

T112 TX and RX are OTA validated. The known-good RX preset is 433.920 MHz ASK/OOK, 9090.909 requested samples/s (approximately 9087 after CC1111 quantization), 93.750 kHz bandwidth, sync and Manchester disabled, fixed raw packets, CRC/whitening/status disabled, and lowball enabled. The rolling decoder tolerates arbitrary RFCat receive-buffer boundaries, CC1111 slicer jitter, and a final LOW symbol tail merged with host-side idle.

Independently checked TX vectors:

| System | Pager | Cancel | Logical payload | rtl_433 observation |
| ---: | ---: | ---: | --- | --- |
| 0 | 69 | 0 | `000510` | complemented 24-bit value `FFFAEF` |
| 0 | 70 | 0 | `000310` | complemented 24-bit value `FFFCEF` |

Cancel=1 was not part of those independent rtl_433 vector checks.

## T119 and TD165

Pagger documents T119 and TD165 as 24-bit 433.920 MHz OOK formats with a 13-bit station, 10-bit pager and 1-bit action. The fields are bit-reversed. The Princeton representation uses TE 271 µs, with 1:3 and 3:1 HIGH/LOW pulse ratios and a long LOW frame trailer.

RFCat Web supports one explicit station/pager/action tuple, a selected sequential pager range within that station, and the source-documented pager 1005 special all-pagers command. The source material should be consulted for the exact operational meaning of that special command on a particular hardware revision; it should not be treated as an invented generic broadcast address.

Both T119 and TD165 TX/RX are OTA validated. Their final receiver preset is 433.920 MHz ASK/OOK, 14760.1476 raw samples/s, 93.750 kHz bandwidth, sync and Manchester disabled, fixed raw packets, CRC/whitening/status disabled, no address check, lowball enabled, and decoder `sampleScale=4`.

Earlier 3690.0369 samples/s captures proved that RF acquisition worked but were marginal for decoding because one receiver sample was approximately one TE. Real asynchronous CC1111 captures could turn short pulses into long phase-shifted `AA`/`55` regions. Four-times oversampling preserves enough timing resolution for reliable 1:3 versus 3:1 classification.

## TD157

Pagger documents TD157 at 433.920 MHz OOK with 10 station bits, 10 pager bits and a four-bit action field. Unlike T119/TD165, these fields are kept MSB-first. Normal single/sequential paging uses action `0010` and Princeton TE 212 µs. RFCat Web exposes station and pager values, supports a selected sequential range, fixes normal paging to action 2, and exposes the documented pager 999/action 15 special all-pagers command.

TD157 TX/RX are OTA validated. The final receiver preset is 433.920 MHz ASK/OOK, 18867.9245 raw samples/s, 93.750 kHz bandwidth, sync and Manchester disabled, fixed raw packets, CRC/whitening/status disabled, no address check, lowball enabled, and `sampleScale=4`.

The earlier 4716.981 samples/s preset could receive recognizable traffic but was marginal at one sample per 212 µs TE. Moving RX to four samples per TE restored reliable OTA decoding without changing the transmitted TE or logical format.

## TD161

BayCom documents TD161 as 433.920 MHz OOK at 5000 symbols/s. The frame contains BCD pager ID, function, BCD system ID and trailing zero nibbles. Logical zero is `1000` and one is `1110`. RFCat Web repeats the frame 30 times.

RFCat Web supports explicit system and pager IDs, a sequential pager range within that system, and the documented pager 999 all-pagers command.

TD161 TX/RX are OTA validated. The known-good RX settings are 433.920 MHz ASK/OOK, 5000 samples/s, 93.750 kHz bandwidth, sync and Manchester disabled, fixed raw packets, CRC/whitening/status disabled, and lowball enabled. RX uses a rolling buffer and timing-tolerant decoding anchored by the trailing LOW symbols.

## TD164

BayCom documents TD164 as 433.920 MHz 2-FSK at 10 kbit/s. It uses ten `0xAA` bytes followed by preamble `0x12340205`, a sequence nibble, separator 9, function, three BCD pager digits, two checksum nibbles and trailing zero bytes. RFCat Web repeats the frame 20 times.

The implementation exposes pager ID, sequence and function codes 1 (Page), 2 (Program) and 4 (Mute control), and supports a selected sequential pager range. No separate TD164 broadcast address is asserted by the sources used here.

TD164 TX/RX are OTA validated with the current 433.920 MHz 2-FSK, 10 kbit/s, 93.750 kHz bandwidth and 15 kHz requested deviation configuration. The decoder searches for the fixed preamble, validates separator and BCD digits, and verifies both checksum nibbles before reporting a frame.

Raw TD164 receive mode can still display unrelated 2-FSK activity because hardware sync is disabled and RFCat returns fixed raw buffers. A successful protocol decode is therefore a stronger signal than the presence of raw RX packets. Further UI-side raw-noise suppression can be added independently of the validated protocol decoder.

## TD174

Pagger documents TD174 at 433.889 MHz OOK using an SMC5326-style representation with TE 326 µs. OTA testing confirmed the logical field order used by this implementation:

`13-bit station → 2-bit action → 8-bit pager → trailing 0`

The field order matters. Reusing the generic T119 order (`station → pager → action`) produced stable frames but incorrect pager values, including a received pager 68 when pager 1 had been transmitted. RFCat Web therefore uses an explicit action-before-pager mapping for both TD174 TX and RX.

RFCat Web implements the normal page action, supports pager IDs 0-255 and a selected sequential pager range. No separate TD174 all-pagers command is asserted by the sources used here.

TD174 TX/RX are OTA validated. The final RX preset is 433.889 MHz ASK/OOK, 12269.9387 raw samples/s, 93.750 kHz bandwidth, sync and Manchester disabled, fixed raw packets, CRC/whitening/status disabled, no address check, lowball enabled, and `sampleScale=4`.

## Shared OOK receiver findings

The most important OTA finding for the Princeton-style Retekess formats is that **protocol TE and CC1111 raw RX sampling rate are different quantities**. A receiver configured near one sample per TE can visibly capture the transmission but still lose the short-pulse timing needed for decoding.

T119, TD157, TD165 and TD174 therefore use four raw samples per TE. The shared decoder scales the expected pulse widths by `sampleScale`, searches across arbitrary bit/byte alignment, builds HIGH/LOW runs, suppresses short slicer glitches, finds long LOW frame trailers, searches around imperfect repeated-frame boundaries, and handles the final data LOW merging directly into the trailer.

These changes came from real OTA captures. They are intentionally protocol-specific so the already validated T112 and TD161 receive paths do not need to inherit Princeton timing assumptions.

## Receive buffering and decoding

Retekess RX uses rolling input where required because a logical transmission is not guaranteed to align with a 250/255-byte RFCat receive callback. Decoders should treat RFCat packet boundaries as transport boundaries, not RF frame boundaries.

The shared Princeton decoder has both an exact path for generated/reference frames and a timing-tolerant path for asynchronously sampled OTA data. TD164 uses its own 2-FSK frame parser and checksum validation. T112 and TD161 use dedicated decoders matching their distinct framing.

When troubleshooting, first verify that selecting a protocol applies its receiver preset and that raw packets contain repeated structured traffic. A raw capture alone is not proof of a valid decoded frame. For OOK, long `AA`/`55` or `11`/`22`/`44`/`88` patterns can indicate that RF is being received while the raw sampling rate is too close to one sample per TE.

## Sequential and special commands

RFCat Web does not brute-force or enumerate unknown systems. Sequential paging means transmitting a user-selected pager range inside a known configured station/system. Special all-pagers controls are exposed only where the source material documents a protocol-specific command.

Current behavior:

- T112: single pager and sequential range; no asserted broadcast address.
- T119/TD165: single pager, sequential range, and source-documented pager 1005 special command.
- TD157: single pager, sequential range, and pager 999/action 15 special command.
- TD161: single pager, sequential range, and documented pager 999 all-pagers command.
- TD164: single pager and sequential range; no asserted broadcast address.
- TD174: single pager and sequential range; no asserted broadcast address.

## Scope

These implementations are intended for known systems and equipment you own or are explicitly authorized to test. Validation was performed against the tested hardware/configuration and should not be assumed to cover every Retekess hardware revision.

When changing receiver timing, keep the OTA regression history in mind: a configuration can capture recognizable RF while still being too coarsely sampled for reliable pulse decoding. Run the automated tests and repeat a known OTA vector before changing a validated preset.
