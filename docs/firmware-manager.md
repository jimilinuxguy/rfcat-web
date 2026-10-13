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
4. Run a two-pass backup and check the downloaded file is saved. Select the local HEX, review address and size validation, check the explicit compatibility acknowledgment, then confirm the destructive erase/write/verify operation.
5. Only after programmed-record readback **and full 27,648-byte post-flash comparison** succeed can you choose **Run verified firmware**. Reconnect to normal WebUSB to confirm the application responds.

## Safety and limitations

- **Hardware-validated:** A YARD Stick One successfully completed WebUSB bootloader transition, Web Serial connection, two-pass full backup, backup-versus-device comparison, erase, program, programmed-record verification, firmware run and normal WebUSB reconnection (user-reported October 2026). The newly added full-region post-flash verification has not yet been validated on hardware.
- USB VID/PID identifies the expected bootloader but cannot cryptographically authenticate firmware, prove the attached board revision, or detect a malicious USB emulator. Validate firmware provenance yourself.
- Firmware version is not exposed by the bootloader protocol. This UI does not invent one.
- The Firmware Manager can request entry into bootloader mode using RFCat system command 0x87, which is documented upstream. The transition has been confirmed on a physical YARD Stick One; a command acknowledgment or timeout alone does not prove the transition succeeded on other hardware. It remains a user-triggered action, not automatic flashing.
- The browser cannot install or recover a missing/damaged bootloader; use a CC1111 hardware debugger.
- A failure or USB disconnect during erase/write leaves the application potentially unusable. If bootloader enumerates, reconnect and retry the entire flash; if it does not, use a hardware debugger.
- The bootloader's one-byte write acknowledgment does **not** prove flash contents. The programmed-record comparison and subsequent full-region comparison must both succeed before the UI enables Run.
- The bootloader can silently protect its own pages; client validation independently rejects writes below 0x1400.
- On platforms where the OS claims the CDC interface, WebUSB may be blocked. Web Serial is the supported path.
- This initial implementation does not automatically fetch and pin official release assets or verify signed upstream release hashes. Select a trusted local file.
- Avoid concurrent tabs, other serial clients, or unplugging during flashing.

## Tests

Run `npm run verify` locally. `tests/firmware-manager.test.js` exercises HEX validation, bounds, command encoding, simulated erase/write/readback and failure injection. Mock results do not establish real USB timing, serial-driver interoperability, or RF behavior.

Remaining hardware acceptance: validate full-region post-flash comparison, serial permission/reconnect behavior on additional operating systems, disconnection mid-write, read timeout, and recovery using a sacrificial device.

## Non-destructive bootloader readback test

After connecting the bootloader through Web Serial, click **Test readback (16 bytes, no writes)**. This sends only the CC bootloader's Intel HEX read command (type 0x25) for application addresses 0x1400–0x140F, validates that all 16 bytes were returned, and displays the hexadecimal values. It does not erase, program, reset, or run firmware, and does not require a firmware file. The contents may be arbitrary or all FF; successful communication and complete readback are what matter. A successful readback does not by itself establish firmware authenticity or prove write support. Hardware readback was confirmed on a YARD Stick One.

## Full application backup and restore

1. Enter bootloader mode from normal RFCat, then connect through Web Serial.
2. Click **Backup and verify application flash (Intel HEX)**. The browser reads all 27,648 application bytes at 0x1400–0x7FFF in 16-byte blocks using read-only command 0x25. It reads the entire region a second time and compares every byte.
3. Only if both passes match does the browser download a timestamped Intel HEX file. A read failure or mismatch aborts export. Preserve the downloaded file somewhere safe.
4. To restore, choose the exported HEX in the firmware file picker. The existing firmware validation and explicit erase/flash/verify confirmation workflow applies. **Restoring is destructive** and requires the CC bootloader to remain operational.

The backup covers **application flash only**, not the protected bootloader, configuration outside application flash, or the hardware's unique identity. Matching two reads confirms repeatability, not cryptographic provenance or that the firmware is valid. Restoring the saved HEX through the current programmer may not reproduce every erased (0xFF) byte as an explicit write; the erase-all operation restores those bytes to 0xFF. Full backup, two-pass comparison, HEX export and restoring that backup have been user-validated on a YARD Stick One.

## Verify device against a selected HEX (read-only)

With the bootloader connected, select a valid application HEX file (including a backup exported by Firmware Manager) and click **Verify device against HEX (read-only)**. The operation reads all 27,648 application flash bytes via command 0x25 and compares them against the selected HEX image, treating addresses omitted from sparse HEX images as erased (0xFF). It reports the first mismatching address with expected and actual values and never erases, writes, or executes firmware. The button does not require the destructive-flash confirmation checkbox. A successful comparison is evidence that the currently installed application flash matches the file, not proof of image provenance or suitability for the board.

## Mandatory backup gate before flashing

**Erase, flash and verify** remains disabled until all of the following are true in the **current bootloader connection**: a complete two-pass application flash backup has succeeded and its Intel HEX download has been initiated, a structurally valid firmware HEX is selected, and the destructive-flash confirmation checkbox is checked. Disconnecting or reconnecting the bootloader resets the backup gate. A failed backup also clears it. The final confirmation dialog reminds you to ensure the downloaded backup is safely saved before proceeding.

**Important:** The browser cannot confirm that the operating system actually saved the downloaded file. Check your Downloads folder and preserve the backup independently before approving erase. The backup covers application flash only (0x1400–0x7FFF), **not the protected bootloader**. Do not flash until you have a recoverable copy and have confirmed the target firmware is appropriate. The destructive erase/flash/run path was user-validated on a YARD Stick One; the new full-region post-flash check still needs hardware validation.

## Full-region post-flash verification

After erasing, writing and verifying programmed records, Firmware Manager now reads **all 27,648 application bytes** and compares them with the selected HEX, treating omitted sparse-HEX addresses as erased (0xFF). Progress reserves the final 20% for this check. **Run verified firmware** remains disabled until both the programmed-record and full-region checks pass. A mismatch reports the first failing address and does not automatically run or erase again. This check was added after the first successful hardware restore; it still needs a new hardware test.
