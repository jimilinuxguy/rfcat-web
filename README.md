# RFCat Web

Browser-native control of RFCat-compatible CC1111 radios using WebUSB.

RFCat Web provides a lightweight web interface for controlling devices such as the **Great Scott Gadgets YARD Stick One** directly from a Chromium-based browser without Python, libusb, or a local RFCat backend.

The application implements RFCat's USB protocol directly in JavaScript and supports radio configuration, packet reception, raw ASK/OOK experimentation, protocol-specific transmission, and SDR-assisted protocol analysis.

> Only transmit on frequencies, devices, and systems you are authorized to use.

---

## Features

### WebUSB RFCat Interface

- YARD Stick One discovery through WebUSB
- Native RFCat USB framing
- RFCat endpoint 5 OUT / `0x85` IN communication
- RFCat message parser
- System ping
- Register peek/poke
- Radio mode control
- Radio configuration readback
- Full CC1111 radio register dump
- Activity/debug console

No Python or local backend is required after the web application is loaded.

---

## Radio Configuration

The UI supports configuration of:

- Frequency
- Modulation
- Data rate
- Channel bandwidth
- Sync word
- Sync mode
- Fixed or variable packet length
- Maximum/fixed packet length
- CRC
- Data whitening
- Append RSSI/LQI status
- Address checking
- Device address

The radio layer additionally supports:

- CC1111 frequency deviation configuration
- Manchester encoding
- PATABLE configuration
- TX PA selection
- YARD Stick One amplifier control
- Protocol-specific radio presets

Radio configuration can also be read directly from the CC1111 and displayed in human-readable form.

---

## Receiver

RFCat Web can place the radio directly into RX mode and display received RFCat buffers.

Receiver statistics include:

- RX event count
- Total bytes received
- RSSI
- LQI
- Radio state

When sync detection is disabled, received entries may represent raw RFCat receive buffers rather than decoded protocol packets.

### Lowball Mode

An optional **Lowball** preset is provided for weak/raw OOK reception.

The preset applies the RFCat-style lowball register changes:

```text
SYNC1      0xAA
SYNC0      0xAA
PKTLEN     0xFA
PKTCTRL1   0x00
MDMCFG2    0x34
FSCAL2     0x00
TEST1      0xC5
```

Lowball is intentionally optional and should normally remain disabled for transmission.

After entering RX mode, RFCat Web avoids register polling that could disturb active reception.

---

## Transmitter

RFCat Web supports several TX input modes.

### Hex Bytes

Transmit arbitrary byte sequences:

```text
F0 CC AA 55 0F
```

Whitespace is ignored.

### Binary OOK Symbols

Binary mode allows an OOK waveform to be represented directly as `1` and `0` symbols.

For example:

```text
11110000 11001100 10101010 01010101 00001111
```

is packed as:

```text
F0 CC AA 55 0F
```

This is useful for experimenting with pulse protocols where the CC1111 data rate is used as the waveform timing clock.

### Protocol Encoders

Protocol-specific TX modes can generate packets or waveforms from higher-level fields rather than requiring manually entered raw bytes.

Current protocol support includes:

- Experimental CAME-12 ASK/OOK waveform generation
- LRS pager packet generation and 2-FSK transmission

Protocol encoders are kept separate from the WebUSB transport so they can be tested independently of radio hardware.

---

## ASK/OOK Transmission

ASK/OOK transmission requires the CC1111 PA path to select the appropriate PATABLE entry.

RFCat Web sets:

```text
FREND0.PA_POWER = 1
```

immediately before ASK/OOK transmission.

Without this setting, testing showed that the CC1111 could transmit what appeared to be a continuous carrier rather than the intended ASK/OOK bitstream.

A known-good ASK/OOK test is:

```text
Frequency:   433.920 MHz
Modulation:  ASK/OOK
Data rate:   ~4795 baud
Sync mode:   None
Payload:     F0 CC AA 55 0F
```

SDR verification produced:

```text
F0 CC AA 55 0F
```

over the air.

---

## LRS Pager Transmission

RFCat Web supports generation and transmission of LRS pager packets for protocol analysis and testing with equipment you own or are authorized to operate.

Selecting **LRS Pager** exposes protocol-specific controls for:

- Restaurant ID
- Pager ID
- Alert type
- Manual alert value
- Generated packet preview

### LRS Radio Configuration

The LRS transmitter automatically configures the YARD Stick One for:

| Setting | Value |
|---|---|
| Frequency | 467.750 MHz |
| Modulation | 2-FSK |
| Data rate | 625 baud |
| Frequency deviation | ~14.648 kHz |
| Manchester encoding | Enabled |
| Sync mode | Disabled |
| CRC | Disabled |
| Whitening | Disabled |

The requested frequency deviation is 15 kHz. The nearest CC1111 `DEVIATN` configuration produces approximately 14.648 kHz.

The LRS TX path is intentionally separate from the ASK/OOK PA configuration.

For 2-FSK transmission, RFCat Web configures the appropriate PATABLE entry and enables the YARD Stick One amplifier for transmission. The amplifier is disabled again after transmission.

### LRS Packet Format

The current LRS pager packet format is:

```text
PREAMBLE | SYNC | RESTAURANT | STATION/PAGER | RESERVED | ALERT | CHECKSUM
```

The current fields are constructed as:

```text
Preamble:       AA AA AA
Sync:           FC 2D
Restaurant ID:  1 byte
Station/Pager:  2 bytes
Reserved:       5 bytes
Alert:          1 byte
Checksum:       1 byte
```

For example:

```text
Restaurant ID: 1
Pager ID:      1
Alert:         1
```

generates:

```text
AA AA AA FC 2D 01 00 01 00 00 00 00 00 01 2D
```

The final byte is the protocol checksum.

### LRS Over-the-Air Verification

LRS transmission has been independently verified using an RTL-SDR and Universal Radio Hacker (URH).

A working URH configuration is:

```text
Center frequency:    467.750 MHz
Sample rate:         1 MS/s
Bandwidth:           200 kHz
Modulation:          FSK
Samples per symbol:  1600
Bits per symbol:     1
Encoding:            Manchester II
```

At a 1 MS/s sample rate and 625-baud logical data rate:

```text
1,000,000 / 625 = 1600 samples per logical bit
```

For the example packet above, repeated over-the-air captures decoded as:

```text
aaaaaafc2d0100010000000000012d
aaaaaafc2d0100010000000000012d
aaaaaafc2d0100010000000000012d
aaaaaafc2d0100010000000000012d
aaaaaafc2d0100010000000000012d
```

This is byte-for-byte identical to the data supplied to RFCat:

```text
AA AA AA FC 2D 01 00 01 00 00 00 00 00 01 2D
```

This verifies the complete transmission path:

```text
Web UI
  → LRS packet encoder
  → WebUSB RFCat transport
  → YARD Stick One / CC1111
  → 2-FSK + Manchester RF transmission
  → RTL-SDR
  → URH
  → original packet bytes
```

---

## PATABLE

The CC1111 PA table can be inspected directly.

An observed ASK/OOK configuration is:

```text
PATABLE:
C0 00 00 00 00 00 00 00
```

ASK/OOK transmission uses `FREND0.PA_POWER = 1` as required by the RFCat-style CC1111 configuration.

The LRS 2-FSK configuration uses the appropriate non-OOK PA path instead of applying the ASK/OOK-specific `PA_POWER = 1` behavior.

The PA configuration should not be interpreted as calibrated RF output-power control.

---

## Experimental CAME-12 Waveform Generator

RFCat Web currently contains experimental support for generating 12-bit CAME-style ASK/OOK waveforms.

This functionality is intended for protocol analysis and testing with equipment you own or are authorized to operate.

### Timing

Testing with SDR captures indicates a base timing near:

```text
T  ≈ 320 µs
2T ≈ 640 µs
```

A data rate of approximately:

```text
3125 baud
```

therefore provides one transmitted OOK symbol per approximately 320 µs:

```text
1 / 3125 = 320 µs
```

At an SDR sample rate of 1 MS/s:

```text
T  ≈ 320 samples
2T ≈ 640 samples
3T ≈ 960 samples
```

### Current Encoder

The current experimental encoder represents each 12-bit data bit using three timing units:

```text
0 → HIGH T  + LOW 2T
1 → HIGH 2T + LOW T
```

or equivalently:

```text
0 → 100
1 → 110
```

A test code such as:

```text
101001011010
```

is converted into an OOK symbol stream, packed into bytes, and transmitted through RFCat's `NIC_XMIT`.

### Repetition

Current testing uses:

```text
3 bursts
31T inter-burst gap
```

For a 12-bit frame:

```text
12 bits × 3T = 36 symbols
```

Three frames plus two gaps therefore contain:

```text
3 × 36 = 108 frame symbols
2 × 31 = 62 gap symbols

108 + 62 = 170 meaningful symbols
```

The stream is padded to a complete byte:

```text
170 meaningful symbols
+ 6 padding symbols
-------------------
176 transmitted symbols
= 22 bytes
```

A verified test run reports:

```text
CAME-12 TX:
101001011010 · 3 bursts · 176 symbols · 22 bytes
```

with:

```text
D3 49 A6 D3 40 00 00 00
1A 69 34 DA 68 00 00 00
03 4D 26 9B 4D 00
```

### Status

The CAME-12 encoder is **experimental**.

SDR testing has verified:

- 433.92 MHz transmission
- ASK/OOK modulation
- approximately 320 µs base timing
- approximately 1:2 short/long timing
- three generated bursts
- controlled inter-burst silence
- correct byte packing through `NIC_XMIT`

The remaining work is to compare the generated pulse ordering and framing against captures from authorized reference hardware.

Do not assume that the current logical `0`/`1` mapping represents every CAME transmitter or protocol variant.

---

## SDR Analysis

RFCat Web has been tested alongside:

- RTL-SDR
- Universal Radio Hacker (URH)
- inspectrum
- rtl_433

### CAME Analysis

For CAME waveform analysis, a useful URH starting configuration is:

```text
Sample rate:       1 MS/s
Frequency:         433.920 MHz
Modulation:        ASK
Samples/Symbol:    320
Bits/Symbol:       1
Signal view:       Demodulated
```

At 1 MS/s, the relationship between samples and timing is particularly convenient:

```text
320 samples ≈ 320 µs
640 samples ≈ 640 µs
960 samples ≈ 960 µs
```

### LRS Analysis

For LRS pager analysis, a verified URH configuration is:

```text
Sample rate:       1 MS/s
Frequency:         467.750 MHz
Bandwidth:         200 kHz
Modulation:        FSK
Samples/Symbol:    1600
Bits/Symbol:       1
Encoding:          Manchester II
```

Receiver threshold and gain should be adjusted for the local SDR setup.

---

## RFCat USB Protocol

RFCat Web communicates directly with the RFCat firmware.

### Outbound Frame

```text
APP
CMD
LEN_LO
LEN_HI
PAYLOAD...
```

where the payload length is a little-endian 16-bit integer.

### Inbound Frame

RFCat firmware responses are prefixed with:

```text
0x40
APP
CMD
LEN_LO
LEN_HI
PAYLOAD...
```

### Applications

```text
APP_SYSTEM = 0xFF
APP_NIC    = 0x42
```

### System Commands

```text
SYS_PEEK    = 0x80
SYS_POKE    = 0x81
SYS_PING    = 0x82
SYS_RFMODE  = 0x88
SYS_PARTNUM = 0x8E
```

### NIC Commands

```text
NIC_RECV         = 0x01
NIC_XMIT         = 0x02
NIC_SET_AMP_MODE = 0x0A
```

### RF Modes

```text
RF_RX   = 0x02
RF_TX   = 0x03
RF_IDLE = 0x04
```

---

## RFCat Transmission Format

`NIC_XMIT` uses the same payload structure as Python RFCat:

```text
uint16_le data_length
uint16_le repeat
uint16_le offset
data...
```

For example, transmitting 22 bytes produces:

```text
42 02 1C 00
16 00
00 00
00 00
<data...>
```

where:

```text
0x001C = 28-byte NIC_XMIT payload
0x0016 = 22-byte RF payload
repeat = 0
offset = 0
```

An LRS transmission containing 15 RF bytes therefore uses:

```text
data_length = 15
repeat      = configured repeat value
offset      = configured offset value
data        = generated LRS packet
```

---

## Tesla Charge Port Transmitter

The Tesla transmitter implements the ASK/OOK waveform used by the original `TeslaPop.py` RFCat/YARD Stick One implementation.

> **Use only with vehicles and RF systems you own or are authorized to test.**

### Reference Configuration

The original RFCat implementation configures the YARD Stick One with:

```python
d.setModeIDLE()
d.setMdmModulation(MOD_ASK_OOK)
d.setFreq(433920000)
d.setMdmDRate(2500)
d.setAmpMode(1)
```

The reference transmission sends the same 42-byte frame five times:

```text
15 55 55 51 59 4C B5 55
52 D5 4B 4A D3 4C AB 4B
15 94 CB 33 33 2D 54 B4
56 9A 65 5A 48 AC C6 59
99 99 69 A5 B2 B4 D4 2A
D2 80
```

This produces a 210-byte transmit buffer:

```text
42 bytes × 5 frames = 210 bytes
```

The five frames are constructed by the Tesla encoder before transmission. The generic RFCat transmit repeat value should therefore remain `0`.

### Radio Configuration

The WebUSB implementation configures Tesla transmission as:

| Setting | Value |
|---|---|
| Frequency | 433.920 MHz |
| Modulation | ASK/OOK |
| Data rate | 2500 baud |
| Sync | Disabled |
| Manchester | Disabled |
| Frame size | 42 bytes |
| Frames | 5 |
| TX buffer | 210 bytes |
| RFCat outer repeat | 0 |
| External amplifier | Enabled during TX |

The UI also provides a selectable 315 MHz option for authorized testing. The original `TeslaPop.py` reference uses **433.920 MHz**.

### ASK/OOK PA Configuration

Correct PA configuration is important for generating the OOK waveform.

During development, an incorrect PATABLE address caused the transmitter to produce an almost continuously keyed carrier rather than the expected ASK/OOK pulse train.

The CC1111 PATABLE base used by this project is:

```js
PATABLE: 0xdf2d
```

The known-good RFCat Tesla configuration showed:

```text
PATABLE[0] = 0xC0
FREND0     = 0x11
```

The Tesla transmit path explicitly establishes the required ASK/OOK PA state before transmission.

For example:

```js
async configureAskOokPa() {
    const pa = new Uint8Array([
        0xc0, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
    ]);

    await this.poke(R.PATABLE, pa);

    let frend0 = (await this.peek(R.FREND0, 1))[0];

    // PA_POWER = 1 while preserving the remaining FREND0 bits.
    frend0 = (frend0 & 0xf8) | 0x01;

    await this.poke(R.FREND0, new Uint8Array([frend0]));
}
```

The external YARD Stick One amplifier is then enabled immediately before transmission and disabled afterward.

### Transmit Sequence

The Tesla transmit path follows this sequence:

```text
RF_IDLE
   ↓
Set ASK/OOK modulation
   ↓
Set carrier frequency
   ↓
Set 2500 baud
   ↓
Configure ASK/OOK PATABLE
   ↓
Set FREND0 PA_POWER = 1
   ↓
Enable external amplifier
   ↓
Transmit 210-byte buffer
   ↓
RF_IDLE
   ↓
Disable external amplifier
```

Conceptually:

```js
await d.mode(C.RF_IDLE);

await d.setModulation(0x30);
await d.setFrequency(frequencyMHz * 1_000_000);
await d.setDataRate(2500);

await d.configureAskOokPa();

await d.setAmpMode(true);

await d.transmit(bytes, 0, 0);

await d.mode(C.RF_IDLE);
await d.setAmpMode(false);
```

### Waveform Verification

The implementation was compared against the original Python/RFCat transmitter using Universal Radio Hacker (URH).

For a 1 MS/s capture at 2500 baud:

```text
Samples per symbol = 1,000,000 / 2,500
                   = 400
```

Recommended URH interpretation settings for this capture are therefore:

```text
Modulation:       ASK
Bits/Symbol:      1
Samples/Symbol:   400
```

The corrected WebUSB transmitter produces clearly separated ASK/OOK high/low transitions matching the structure produced by the native RFCat implementation.

The five transmitted frames also show approximately 4 ms inter-frame pauses in a 1 MS/s URH capture:

```text
~4000 samples / 1,000,000 samples/sec
≈ 4 ms
```

### Troubleshooting

If URH displays an almost continuous carrier and decodes mostly `111111...`, first verify the ASK/OOK PA configuration.

In particular, check:

```text
PATABLE base = 0xDF2D
PATABLE[0]   = 0xC0
FREND0       = 0x11
```

A valid USB `NIC_XMIT` transaction only confirms that the payload reached RFCat. It does not by itself prove that the CC1111 generated the correct over-the-air OOK waveform.

For waveform debugging, compare the WebUSB transmission against a known-good native RFCat transmission using identical SDR and URH settings.

## Running RFCat Web

Clone the repository and serve it over HTTP.

For example:

```bash
git clone <repository-url>
cd rfcat-web
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

in a Chromium-based browser with WebUSB support, such as desktop Chrome or Edge.

Click:

```text
Connect YS1
```

and select the YARD Stick One.

### GitHub Pages

RFCat Web is a static browser application and can also be hosted using GitHub Pages.

Configure GitHub Pages to deploy from the repository's main branch and root directory.

WebUSB requires a secure context. GitHub Pages provides HTTPS, making it suitable for browser-based WebUSB access.

---

## WebUSB Notes

The YARD Stick One currently uses:

```text
VID: 0x1D50
PID: 0x605B
```

RFCat communication uses:

```text
Bulk OUT: endpoint 5
Bulk IN:  endpoint 0x85
```

Only one application should control the device at a time.

Close or disconnect:

- Python RFCat sessions
- libusb applications
- other RFCat Web tabs
- other applications attempting to access the YARD Stick

before connecting through WebUSB.

Occasionally the initial RFCat ping may time out immediately after opening the USB device. Disconnecting/reconnecting currently recovers from this condition. Improving startup/retry handling is on the TODO list.

---

## Project Structure

The browser UI is intentionally kept separate from the RFCat transport and protocol encoders:

```text
app.js                    UI state and event wiring
js/core/bytes.js          Byte/hex helpers
js/rfcat/constants.js     RFCat commands, modes, supported USB IDs
js/rfcat/device.js        WebUSB transport + RFCat/CC1111 device operations
js/radio/registers.js     Named CC1111 register addresses
js/radio/presets.js       Reusable radio configuration presets
js/protocols/binary.js    Raw binary OOK packing
js/protocols/came12.js    Experimental CAME-12 waveform encoder
js/protocols/lrs.js       LRS pager packet encoder and checksum
js/ui/log.js              DOM lookup and activity logging
tests/                    Hardware-independent protocol/unit tests
```

Protocol encoders should remain pure functions: they accept data/options and return bytes/waveforms without accessing WebUSB or the DOM. This keeps them testable without radio hardware.

### Tests

The test suite uses Node's built-in test runner and has no package dependencies:

```bash
npm test
```

When adding a protocol encoder, add tests for its packet/waveform construction, expected length, byte packing, checksum where applicable, padding, and invalid inputs before wiring it into the transmitter UI.

---

## Development Status

RFCat Web is under active development.

Currently verified:

- [x] WebUSB device discovery
- [x] RFCat USB framing
- [x] System ping
- [x] Register peek/poke
- [x] Radio register dump
- [x] Frequency configuration
- [x] ASK/OOK modulation
- [x] 2-FSK modulation
- [x] Data-rate configuration
- [x] Channel-bandwidth configuration
- [x] CC1111 frequency-deviation configuration
- [x] Sync configuration
- [x] Manchester encoding
- [x] Fixed/variable packet configuration
- [x] CRC configuration
- [x] Whitening configuration
- [x] Address checking
- [x] RX mode
- [x] RFCat packet reception
- [x] Lowball RX preset
- [x] Hex transmission
- [x] RFCat repeat/offset support
- [x] Binary OOK waveform transmission
- [x] ASK/OOK PA selection
- [x] PATABLE inspection
- [x] YARD Stick One TX amplifier control
- [x] Experimental CAME-12 waveform generation
- [x] SDR verification of ~320/640 µs CAME timing
- [x] LRS pager packet encoder
- [x] LRS restaurant/pager/alert controls
- [x] LRS packet checksum generation
- [x] LRS radio configuration
- [x] LRS 2-FSK + Manchester transmission
- [x] LRS over-the-air verification with RTL-SDR/URH
- [x] Tesla Charger Port Opener
- [ ] Automatic USB startup recovery
- [ ] Persistent UI settings
- [ ] Calibrated TX power control
- [ ] Additional protocol encoders
- [ ] Further CAME framing/polarity validation

---

## Safety and Legal Use

RFCat Web provides low-level access to RF hardware.

Users are responsible for complying with applicable radio regulations and for transmitting only on frequencies, devices, and systems they are authorized to use.

Protocol-analysis features are intended for development, interoperability research, laboratory experimentation, and testing of equipment under the user's control.

---

## License

See the repository license for details.