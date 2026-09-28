# RFCat Web

A dependency-free browser UI for RFCat-compatible CC1111 devices, especially the Great Scott Gadgets YARD Stick One. It talks directly to RFCat firmware through WebUSB. No Python RFCat process or local backend is required.

## Current MVP

- WebUSB discovery for known RFCat VID/PIDs
- Native RFCat EP5 framing and response parser
- Ping and radio configuration readback
- Frequency, modulation, data rate, channel bandwidth, sync word, and sync mode controls
- RX / IDLE controls
- Live RFCat packet display
- Hex transmit with RFCat repeat/offset fields
- Responsive dark UI and activity log

## Run

WebUSB requires a secure context. `localhost` is accepted for development.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in desktop Chrome or Edge, click **Connect YS1**, and select the YARD Stick One.

Do not open the device in `rfcat`, another libusb program, or another browser tab at the same time because the USB interface must be claimed exclusively.

## Architecture

`app.js` contains a small RFCat transport implementation. RFCat firmware uses USB bulk endpoint 5 OUT and endpoint 0x85 IN. Host messages use `[app][cmd][length LE16][payload]`; device messages use `[@][app][cmd][length LE16][payload]`. The implementation keeps a mailbox-like waiter queue similar to RFCat's Python client and dispatches unsolicited `NIC_RECV` frames as browser events.

Radio configuration uses RFCat's `SYS_CMD_PEEK`, `SYS_CMD_POKE`, and `SYS_CMD_RFMODE` commands rather than inventing a separate device protocol. Frequency and modem register calculations mirror the RFCat client formulas for a 24 MHz CC1111 crystal.

## Hardware / firmware

This expects RFCat firmware on the device. YARD Stick One is CC1111-based and supports half-duplex TX/RX in its documented sub-GHz ranges. Browser support is intentionally WebUSB rather than Web Serial because RFCat communicates through USB endpoints, not a CDC serial interface.

## Notes

This is an MVP and needs hardware validation against different RFCat firmware revisions. In particular, test RX framing, radio-state restoration after configuration changes, OOK power-table behavior, and all modem combinations on a real YARD Stick One before treating it as a full RFCat replacement.

Transmit only where and how you are authorized to transmit and comply with applicable spectrum rules.
