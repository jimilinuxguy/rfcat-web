# RFCat Web

Browser-native control of RFCat-compatible CC1111 radios using WebUSB.

RFCat Web provides a lightweight web interface for controlling devices such as the Great Scott Gadgets YARD Stick One directly from a Chromium-based browser without Python, libusb, or a local RFCat backend.

The application implements RFCat's USB protocol directly in JavaScript and supports radio configuration, packet reception, raw ASK/OOK experimentation, protocol-specific transmission, and SDR-assisted protocol analysis.

> **Only transmit on frequencies, devices, vehicles, and systems you are authorized to use.**

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

An optional Lowball preset is provided for weak/raw OOK reception.

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
- Tesla charge-port ASK/OOK waveform transmission

Protocol encoders are kept separate from the WebUSB transport so they can be tested independently of radio hardware.

---

## ASK/OOK Transmission

ASK/OOK transmission requires correct configuration of both the CC1111 PATABLE and `FREND0.PA_POWER`.

During SDR testing, an incorrect PATABLE base address caused the CC1111 to produce an almost continuously keyed carrier rather than the intended ASK/OOK waveform.

The correct PATABLE base used by RFCat Web is:

```text
0xDF2D
```

A known-good RFCat ASK/OOK configuration observed during Tesla waveform testing used:

```text
PATABLE[0] = 0xC0
FREND0     = 0x11
```

The important `FREND0` setting is:

```text
PA_POWER = 1
```

RFCat Web establishes the required PA state before protocol-specific ASK/OOK transmission.

A simple ASK/OOK test configuration is:

```text
Frequency:   433.920 MHz
Modulation:  ASK/OOK
Data rate:   ~4795 baud
Sync mode:   None
Payload:     F0 CC AA 55 0F
```

SDR verification should produce:

```text
F0 CC AA 55 0F
```

over the air.

If an ASK/OOK capture appears as a nearly continuous carrier or decodes primarily as `111111...`, verify the PATABLE base, PA table contents, and `FREND0.PA_POWER` before changing the encoded payload.

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

For 2-FSK transmission, RFCat Web configures the appropriate PA path and enables the YARD Stick One amplifier for transmission. The amplifier is disabled again after transmission.

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

The CC1111 PA table can be inspected and configured directly.

The PATABLE base address used by RFCat Web is:

```text
0xDF2D
```

An observed known-good ASK/OOK configuration is:

```text
PATABLE:
C0 00 00 00 00 00 00 00
```

with:

```text
FREND0 = 0x11
```

For ASK/OOK, the PA table and `FREND0.PA_POWER` must agree on which PA entry is selected.

The LRS 2-FSK configuration uses its appropriate non-OOK PA path instead of blindly applying ASK/OOK-specific PA behavior.

PA-table values should not be interpreted as calibrated RF output-power measurements.

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

The CAME-12 encoder is experimental.

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

The five frames are constructed by the Tesla encoder before transmission. The generic RFCat transmit repeat value should therefore remain:

```text
0
```

### Tesla Radio Configuration

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

The UI also provides a selectable **315 MHz** option for authorized testing.

The original `TeslaPop.py` reference configuration uses **433.920 MHz**.

### Tesla ASK/OOK PA Configuration

Correct PA configuration is essential for generating the expected OOK waveform.

During development, an incorrect PATABLE address caused the transmitter to produce an almost continuously keyed carrier rather than the expected ASK/OOK pulse train.

The corrected CC1111 PATABLE base is:

```js
PATABLE: 0xdf2d
```

A register dump from the known-good native RFCat Tesla configuration showed:

```text
PATABLE[0] = 0xC0
FREND0     = 0x11
```

RFCat Web therefore establishes the appropriate ASK/OOK PA state before Tesla transmission.

Conceptually:

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

The external YARD Stick One amplifier is enabled immediately before transmission and disabled afterward.

### Tesla Transmit Sequence

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

### Tesla Waveform Verification

The WebUSB implementation was compared directly against the original Python/RFCat transmitter using Universal Radio Hacker.

For a 1 MS/s capture at 2500 baud:

```text
Samples per symbol = 1,000,000 / 2,500
                   = 400
```

A useful URH interpretation configuration is therefore:

```text
Sample rate:       1 MS/s
Frequency:         433.920 MHz
Modulation:        ASK
Samples/Symbol:    400
Bits/Symbol:       1
Signal view:       Demodulated
```

The native Python/RFCat implementation produces clearly separated ASK/OOK transitions.

After correcting the PATABLE base and PA configuration, the WebUSB implementation produces the same characteristic pulse structure rather than the previously observed continuous-carrier behavior.

Repeated frames show inter-frame pauses of approximately:

```text
~4000 samples
```

at a 1 MS/s capture rate, corresponding to approximately:

```text
4000 / 1,000,000
= 0.004 seconds
= 4 ms
```

### Tesla Troubleshooting

If URH displays an almost continuous carrier and decodes primarily:

```text
111111111111111111...
```

check the PA configuration before modifying the Tesla payload.

Verify:

```text
PATABLE base = 0xDF2D
PATABLE[0]   = 0xC0
FREND0       = 0x11
```

Also verify:

```text
Frequency:        433.920 MHz
Modulation:       ASK/OOK
Data rate:        2500 baud
Manchester:       Off
RFCat TX repeat:  0
```

A successful `NIC_XMIT` transaction proves that RFCat received the requested byte buffer, but does not by itself prove that the CC1111 generated the expected over-the-air waveform.

For RF debugging, capture both the WebUSB and known-good native RFCat transmissions using identical SDR and URH settings.

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

At 1 MS/s:

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

### Tesla Analysis

For Tesla ASK/OOK analysis:

```text
Sample rate:       1 MS/s
Frequency:         433.920 MHz
Modulation:        ASK
Samples/Symbol:    400
Bits/Symbol:       1
Signal view:       Demodulated
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

The payload length is a little-endian 16-bit integer.

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

Tesla constructs its five repetitions directly into the RF payload:

```text
data_length = 210
repeat      = 0
offset      = 0
data        = 42-byte Tesla frame × 5
```

---

## Project Structure

```text
rfcat-web/
├── index.html
├── app.js
├── styles.css
├── package.json
├── README.md
├── js/
│   ├── core/
│   │   └── bytes.js
│   ├── protocols/
│   │   ├── binary.js
│   │   ├── came12.js
│   │   ├── lrs.js
│   │   └── tesla.js
│   ├── radio/
│   │   ├── presets.js
│   │   └── registers.js
│   ├── rfcat/
│   │   ├── constants.js
│   │   └── device.js
│   └── ui/
│       └── log.js
└── tests/
```

The project intentionally separates:

```text
WebUSB transport
Radio configuration
Protocol encoding
UI behavior
```

so each layer can be tested independently.

---

## Browser Requirements

RFCat Web requires WebUSB.

Use a Chromium-based desktop browser such as:

- Google Chrome
- Microsoft Edge
- Chromium

The application must be served from a secure context:

```text
https://
```

or:

```text
http://localhost
```

Opening `index.html` directly using `file://` is not recommended.

---

## Running Locally

A simple local HTTP server is sufficient.

For example:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

in Chrome or another compatible Chromium browser.

---

## Testing

Protocol encoders are designed to be testable without RF hardware.

Run the JavaScript tests with:

```bash
npm test
```

Hardware-dependent WebUSB functionality requires a connected RFCat-compatible device.

For RF protocol development, SDR verification is strongly recommended.

A useful workflow is:

```text
Protocol encoder
      ↓
RFCat Web
      ↓
YARD Stick One
      ↓
RF
      ↓
RTL-SDR
      ↓
URH / inspectrum
      ↓
Compare expected vs observed waveform
```

---

## Development Notes

### RX

After entering:

```js
await d.mode(C.RF_RX);
```

avoid unnecessary register reads while actively receiving.

Some CC1111/RFCat operations can interfere with active RX behavior.

### TX

Protocol-specific TX modes should:

1. Enter `RF_IDLE`.
2. Configure the required radio parameters.
3. Configure the correct PA path for the modulation.
4. Enable the external amplifier only when required.
5. Transmit the encoded buffer.
6. Return to `RF_IDLE`.
7. Disable the external amplifier.

Where possible, amplifier cleanup should be performed even if transmission throws an exception.

### ASK/OOK

Do not assume that setting `MOD_ASK_OOK` alone is sufficient.

The CC1111 PA configuration must also be correct.

The known-good Tesla debugging work established:

```text
PATABLE base = 0xDF2D
PATABLE[0]   = 0xC0
FREND0       = 0x11
```

Incorrect PA configuration can result in a carrier being transmitted without the expected OOK transitions.

### 2-FSK

ASK/OOK-specific PA configuration should not be blindly applied to 2-FSK modes.

LRS uses a separate 2-FSK configuration path.

---

## Current Status

Working:

- WebUSB connection to YARD Stick One
- RFCat system ping
- Register peek/poke
- Radio configuration
- Radio configuration readback
- Radio register dump
- RX mode
- TX mode
- ASK/OOK transmission
- Binary waveform TX
- Optional Lowball RX configuration
- LRS pager packet generation
- LRS 2-FSK transmission
- LRS Manchester encoding
- LRS OTA verification with RTL-SDR/URH
- Tesla 433.920 MHz configuration
- Tesla 2500-baud ASK/OOK transmission
- Tesla 42-byte frame generation
- Tesla five-frame/210-byte TX construction
- Tesla ASK/OOK PA configuration
- Tesla OTA waveform verification against native RFCat
- Experimental CAME-12 waveform generation

Experimental / continuing work:

- CAME-12 logical pulse mapping
- Additional protocol presets
- Additional RX analysis tooling
- Additional automated radio configuration tests
- Additional SDR-based waveform regression testing

---

## Safety and Legal Notice

Radio transmission is regulated and frequency allocations vary by jurisdiction.

Use RFCat Web only with:

- frequencies you are legally permitted to transmit on,
- devices and vehicles you own or have explicit authorization to test,
- appropriate RF power levels,
- appropriate test environments.

Receiving or analyzing RF signals may also be subject to local laws and regulations.

The project is intended for RF experimentation, interoperability research, education, development, and authorized security testing.

---

## License

See the repository license information for applicable terms.