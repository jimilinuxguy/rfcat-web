# Browser firmware manager

The Firmware Manager lives in **Tools** and uses **Web Serial** in desktop Chromium over HTTPS or localhost. End users do not need Python or a local service. Normal RFCat operation remains on **WebUSB**.

## Verified upstream protocol

Sources: [RFCat bootloader utility](https://github.com/atlas0fd00m/rfcat/blob/master/CC-Bootloader/rfcat_bootloader), [CC-Bootloader firmware](https://github.com/AdamLaurie/CC-Bootloader/blob/master/src/main.c), [USB descriptors](https://github.com/AdamLaurie/CC-Bootloader/blob/master/src/usb_descriptors.c), [protocol header](https://github.com/AdamLaurie/CC-Bootloader/blob/master/src/intel_hex.h), [memory map](https://github.com/AdamLaurie/CC-Bootloader/blob/master/src/main.h), and [RFCat firmware Makefile](https://github.com/atlas0fd00m/rfcat/blob/master/firmware/Makefile).

The YARD Stick One bootloader is **USB CDC ACM**, VID:PID **1D50:605C**, interface 0 CDC control and interface 1 CDC data, bulk OUT endpoint 4, bulk IN endpoint 5, 64-byte packets. It exposes a serial interface. The host utility uses ASCII Intel HEX lines terminated by LF, with one ASCII status digit for write/erase/reset. The read command returns Intel HEX lines ending in an EOF line; some versions only support 16-byte reads. This implementation always reads 16-byte records.

Custom Intel HEX record types: `22` reset erase-map, `23` erase all user pages, `24` erase one page, `25` read flash; standard `00` writes data and `01` runs the user application. Errors 0–5 match the upstream utility. **No speculative vendor USB commands are used.**

CC1111 flash is **0x0000–0x7FFF**, 1 KiB pages, bootloader **0x0000–0x13FF**, application **0x1400–0x7FFF**. Only images entirely in the application range are accepted. Images must have valid HEX checksums, EOF, no conflicting overlaps, and supported address extensions. Writes are packed in 16-byte records grouped by flash page. The bootloader automatically erases a page on first write, so record ordering matters.

## Usage

1. Stop RX/TX. If the YARD Stick One is connected normally, open Firmware Manager and click **Enter bootloader from normal RFCat**. The command (system 0x87) requests a USB-mode switch and disconnects the normal WebUSB session; it does not erase flash. Wait for re-enumeration. If not connected normally, use the board's documented hardware bootloader procedure (P2_2/DC to ground at power-up).
2. In Tools, open Firmware Manager and connect the bootloader using Chrome's serial chooser. Only the expected 1D50:605C USB identity is accepted.
3. Obtain **YARD Stick One bootloader-compatible application HEX**, such as `RfCatYS1CCBootloader.hex`, from a trusted upstream build. Do **not** upload `CCBootloader-rfcat-ys1.hex` (the bootloader itself) or the non-bootloader-offset `RfCatYS1.hex`. [Upstream releases](https://github.com/atlas0fd00m/rfcat/releases) are linked, but the UI does not claim a vetted release manifest or automatically trust unverified downloads.
4. Select the local HEX, review address and size validation, check the explicit compatibility acknowledgment, then confirm the destructive erase/write/verify operation.
5. Only after full programmed-record readback verification succeeds can you choose **Run verified firmware**. Reconnect to normal WebUSB to confirm the application responds.

## Safety and limitations

- **Physical hardware flashing is unverified.** The USB descriptors, protocol and memory layout were inspected in upstream source; browser implementation has not been exercised on a YARD Stick One.
- USB VID/PID identifies the expected bootloader but cannot cryptographically authenticate firmware, prove the attached board revision, or detect a malicious USB emulator. Validate firmware provenance yourself.
- Firmware version is not exposed by the bootloader protocol. This UI does not invent one.
- The Firmware Manager can request entry into bootloader mode using RFCat system command 0x87, which is documented upstream. It has not yet been confirmed on physical YARD Stick One hardware; a command acknowledgment or timeout alone does not prove the transition succeeded. It remains a user-triggered action, not automatic flashing.
- The browser cannot install or recover a missing/damaged bootloader; use a CC1111 hardware debugger.
- A failure or USB disconnect during erase/write leaves the application potentially unusable. If bootloader enumerates, reconnect and retry the entire flash; if it does not, use a hardware debugger.
- The bootloader's one-byte write acknowledgment does **not** prove flash contents. Only the full readback comparison marks the flash verified.
- The bootloader can silently protect its own pages; client validation independently rejects writes below 0x1400.
- On platforms where the OS claims the CDC interface, WebUSB may be blocked. Web Serial is the supported path.
- This initial implementation does not automatically fetch and pin official release assets or verify signed upstream release hashes. Select a trusted local file.
- Avoid concurrent tabs, other serial clients, or unplugging during flashing.

## Tests

Run `npm run verify` locally. `tests/firmware-manager.test.js` exercises HEX validation, bounds, command encoding, simulated erase/write/readback and failure injection. Mock results do not establish real USB timing, serial-driver interoperability, or RF behavior.

Hardware acceptance still needed: identify bootloader with Chrome on Windows/macOS/Linux, confirm serial permission/reconnect behavior, read known firmware without erasing, flash a known-good `RfCatYS1CCBootloader.hex` with recovery equipment available, verify all programmed records, run, and reconnect normal RFCat. Test disconnection mid-write, read timeout, and recovery using a sacrificial device.

## Non-destructive bootloader readback test

After connecting the bootloader through Web Serial, click **Test readback (16 bytes, no writes)**. This sends only the CC bootloader's Intel HEX read command (type 0x25) for application addresses 0x1400–0x140F, validates that all 16 bytes were returned, and displays the hexadecimal values. It does not erase, program, reset, or run firmware, and does not require a firmware file. The contents may be arbitrary or all FF; successful communication and complete readback are what matter. A successful readback does not by itself establish firmware authenticity or prove write support. Hardware validation remains pending.

## Full application backup and restore

1. Enter bootloader mode from normal RFCat, then connect through Web Serial.
2. Click **Backup and verify application flash (Intel HEX)**. The browser reads all 27,648 application bytes at 0x1400–0x7FFF in 16-byte blocks using read-only command 0x25. It reads the entire region a second time and compares every byte.
3. Only if both passes match does the browser download a timestamped Intel HEX file. A read failure or mismatch aborts export. Preserve the downloaded file somewhere safe.
4. To restore, choose the exported HEX in the firmware file picker. The existing firmware validation and explicit erase/flash/verify confirmation workflow applies. **Restoring is destructive** and requires the CC bootloader to remain operational.

The backup covers **application flash only**, not the protected bootloader, configuration outside application flash, or the hardware's unique identity. Matching two reads confirms repeatability, not cryptographic provenance or that the firmware is valid. Restoring the saved HEX through the current programmer may not reproduce every erased (0xFF) byte as an explicit write; the erase-all operation restores those bytes to 0xFF. The full backup workflow still requires physical hardware validation.
