# Security+ 1.0 transmitter

The built-in Security+ transmitter ports the pure waveform encoder from [rfcat-secplus](https://github.com/jimilinuxguy/rfcat-secplus), which derives from [argilo/secplus](https://github.com/argilo/secplus). This is **Security+ 1.0**, not Security+ 2.0.

Select **Transmit → Protocol Transmitter → Security+ 1.0 (rolling code)**, connect your YARD Stick One and enter a profile name, next rolling code (decimal or `0x` hexadecimal), fixed code (decimal or hex), RF frequency, and repetitions. Defaults: 315.150 MHz and four repetitions at 2,000 OOK symbols per second. The inversion checkbox is for diagnostics only. The available WebUSB TX path supports at most 255 packed bytes, so repetitions are limited to four; the encoder itself accepts up to twenty.

Use **Save profile** to persist the entered values in IndexedDB. **Load saved profile** retrieves that profile by name. The last-saved profile is loaded automatically when selecting the protocol with its default name. Counters do not synchronize between browsers or devices.

## Rolling-code safety

The encoder masks the rolling value's low bit. The browser advances the stored code by **two** before each transmission to prevent sending identical encoded waveforms on consecutive transmissions. It reserves the next code in an IndexedDB read-write transaction before the USB TX call. This ensures a send whose USB response is lost does not automatically reuse a code that may have gone on air. The reserved code remains consumed if the transmission fails, and deliberate profile resets may cause synchronization trouble. This advancement is a conservative **encoded-code uniqueness policy**, not a verified Security+ opener synchronization procedure.

RFcat firmware acknowledgment does **not** confirm RF energy or receiver acceptance. Test against a receiver you own or are authorized to operate. The browser currently uses the standard `NIC_XMIT` path, not the Python project's `RFxmitLong` function. A repeat-4 waveform is 225 bytes and a repeat-5 waveform is 275 bytes. The browser prevents oversize packets instead of splitting them, which could change OOK timing.

## Validation

The port includes `tests/security-plus.test.js` with the upstream documented rolling/fixed input pair, expected 225-byte payload, and SHA-256 fixture. Run `npm test` locally. Hardware timing and the transmitter's behavior remain to be verified with a YARD Stick One and a second receiver.

## Licensing

The encoding algorithm is derived from GPL-licensed upstream code. Keep source attribution, upstream notices, and applicable GPL-3.0-or-later licensing obligations when redistributing this module. Review the top-level project's licensing before merging or distributing a combined build.
