# TouchTunes / The Fonz

## Status

**OTA waveform validated**

The RFCat Web implementation ports the normal TouchTunes remote framing and transmit behavior from the supplied `The_Fonz.py` source into the project's protocol-module architecture.

Receiver interoperability with an actual TouchTunes jukebox has **not** been validated.

## RF configuration

The source configures transmission as:

- Frequency: **433.92 MHz**
- Modulation: **ASK/OOK**
- Data rate: **1766 symbols/sec**
- Hardware preamble: disabled
- Hardware sync: disabled

A 1766-symbol/sec rate corresponds to a nominal base interval of approximately **566 µs**.

## Frame construction

The logical 32-bit frame consists of:

1. Sync byte `0x5D`
2. 8-bit PIN encoded least-significant bit first
3. 8-bit command
4. 8-bit command complement (`command ^ 0xFF`)

The logical frame is converted into an OOK waveform using:

- Logical `0` → `10`
- Logical `1` → `1000`

The complete transmitted waveform adds:

- 16 HIGH base symbols
- 8 LOW base symbols
- encoded 32-bit frame
- trailing `1000`

## Example

For PIN `0` and command `0x44` (`OK`), the underlying logical frame is:

```text
5D 00 44 BB
```

The protocol module converts that frame into the variable-length OOK waveform before packing it for RFCat transmission.

## OTA validation

Validation was performed in two stages.

First, the generator produced a synthetic CU8 waveform. Analysis measured a 566 µs base interval, 566 µs short LOW interval, 1698 µs long LOW interval, approximately 9061 µs preamble HIGH, and approximately 4528 µs preamble LOW.

The same test frame was then transmitted over the air with a YARD Stick One and independently captured with an RTL-SDR.

| Signal component | Nominal / synthetic | OTA measured |
| --- | ---: | ---: |
| Base HIGH | ~566 µs | ~580 µs |
| Short LOW (`0`) | ~566 µs | ~548 µs |
| Long LOW (`1`) | ~1698 µs | ~1680 µs |
| Preamble HIGH | ~9056 µs | ~9080 µs |
| Preamble LOW | ~4528 µs | ~4500 µs |
| Short-bit period | ~1132 µs | ~1128 µs |
| Long-bit period | ~2264 µs | ~2260 µs |

The OTA analyzer observed 19 short gaps and 13 long gaps, accounting for all 32 logical frame bits. The pulse/gap structure matched the synthetic waveform.

This validates the RFCat Web encoder, waveform construction, CC1111 configuration, and OTA timing against the supplied source implementation.

It does **not** establish receiver interoperability with an actual TouchTunes jukebox.

## Synthetic sample generation

Generate the PIN `0`, command `0x44` test sample with:

```bash
node tools/generate-touchtunes-sample.mjs 0 44
```

A generated 1 Msps CU8 capture can be inspected with:

```bash
rtl_433 -R 0 -A -vvv -r tmp/touchtunes/touchtunes_pin0_cmd44_1Msps.cu8
```

Because this protocol uses variable-length OOK symbols (`10` and `1000`), rtl_433's automatic analyzer may describe it as generic PWM and display an unhelpful decoded `codes` value. The pulse and gap distributions are the useful validation output.

## OTA analysis

For authorized hardware testing, an RTL-SDR can independently observe the transmitted waveform at 433.92 MHz:

```bash
rtl_433 -R 0 -A -vvv -f 433.92M
```

The expected waveform contains approximately 566 µs base timing, approximately 1698 µs long LOW intervals, and the approximately 9.06 ms / 4.53 ms HIGH/LOW preamble.

## Scope

The RFCat Web module implements explicit user-selected PIN and command transmission for authorized testing. It does not implement the source program's PIN brute-force or continuous-carrier jamming functionality.

Transmit only to equipment you own or are explicitly authorized to test.
