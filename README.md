# RFCat Web

Browser-native control of RFCat-compatible CC1111 radios using WebUSB.

RFCat Web provides a lightweight web interface for controlling devices such as the **Great Scott Gadgets YARD Stick One** directly from a Chromium-based browser without Python, libusb, or a local RFCat backend.

The application implements RFCat's USB protocol directly in JavaScript and supports radio configuration, packet reception, raw ASK/OOK experimentation, and transmission.

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

---

## ASK/OOK Transmission

ASK/OOK transmission requires the CC1111 PA path to select the appropriate PATABLE entry.

RFCat Web sets:

```text
FREND0.PA_POWER = 1
```

immediately before transmission.

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

## PATABLE

The CC1111 PA table can be inspected directly.

A currently observed configuration is:

```text
PATABLE:
C0 00 00 00 00 00 00 00
```

ASK/OOK transmission uses `FREND0.PA_POWER = 1` as required by RFCat's CC1111 configuration.

The PA configuration is still being investigated and should not be interpreted as a calibrated RF output-power control.

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
NIC_RECV = 0x01
NIC_XMIT = 0x02
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

---

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
- SDR/radio software attempting to access the YARD Stick

before connecting through WebUSB.

Occasionally the initial RFCat ping may time out immediately after opening the USB device. Disconnecting/reconnecting currently recovers from this condition. Improving startup/retry handling is on the TODO list.

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
- [x] Data-rate configuration
- [x] Channel-bandwidth configuration
- [x] Sync configuration
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
- [x] Experimental CAME-12 waveform generation
- [x] SDR verification of ~320/640 µs timing
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
js/ui/log.js              DOM lookup and activity logging
tests/                    Hardware-independent protocol/unit tests
```

Protocol encoders should remain pure functions: they accept data/options and return bytes/waveforms without accessing WebUSB or the DOM. This keeps them testable without radio hardware.

### Tests

The test suite uses Node's built-in test runner and has no package dependencies:

```bash
npm test
```

When adding a protocol encoder, add tests for its expected waveform length, byte packing, padding, and invalid inputs before wiring it into the transmitter UI.
