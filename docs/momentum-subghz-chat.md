# Momentum Enhanced Sub-GHz Chat via YARD Stick One

## Status

**Prototype committed, hardware interoperability not yet verified.** No Flipper USB connection is used.

The upstream Enhanced Sub-GHz Chat app writes UTF-8 bytes followed by CR LF when encryption is disabled. Flipper's `subghz_tx_rx_worker` uses the `FuriHalSubGhzPresetGFSK9_99KbAsync` CC1101 preset, variable-length FIFO packets, hardware CRC, and up to 60 application bytes per packet.

RFCat Web now exposes a Momentum Sub-GHz Chat panel with matching GFSK, ~9,996 baud, ~19.04 kHz deviation, sync `0x464C`, 16/16 sync detection, variable packet length, and CRC enabled. The RX handler displays decoded UTF-8 packets; TX sends the CRLF-terminated bytes through the connected YARD Stick One and returns to RX. A message must fit within 60 transmitted bytes, including CRLF.

## Test

1. Connect YARD Stick One through RFCat Web.
2. On Flipper running Momentum, launch Enhanced Sub-GHz Chat and select **No encryption**.
3. Choose the same locally permitted frequency on both devices.
4. Expand **Momentum Sub-GHz Chat (plaintext)** in RFCat Web and select **Start chat**.
5. Send a short message from the Flipper. Check the chat history and Activity log.
6. Send **Hello Flipper** from RFCat Web and check the Flipper's display.
7. Repeat several times to assess RX continuity and packet handling.

Do not use the generic packet receiver concurrently with the dedicated chat panel. RF settings are currently configured by the chat panel and not restored automatically.

## Limitations

- No hardware validation or automated browser test has been performed.
- The radio setup is derived from upstream Flipper firmware, not confirmed against Momentum-specific changes.
- The Flipper worker splits messages longer than 60 bytes into multiple packets. RFCat Web currently rejects those long messages and does not reassemble multi-packet RX messages.
- The receive path assumes RFCat returns the packet payload without a leading length byte and without appended status bytes. Confirm against actual captures.
- Frequency restrictions and radio transmission regulations still apply.
- Encryption is deliberately excluded.

Sources:
- https://github.com/twisted-pear/esubghz_chat/blob/main/esubghz_chat.c
- https://github.com/flipperdevices/flipperzero-firmware/blob/dev/lib/subghz/subghz_tx_rx_worker.c
- https://github.com/flipperdevices/flipperzero-firmware/blob/dev/lib/subghz/devices/cc1101_configs.c
