# Momentum Enhanced Sub-GHz Chat interoperability

## Scope

RFCat Web's YARD Stick One is the intended transceiver. No Flipper USB or Web Serial integration is involved.

**Status: plaintext application payload codec only. Not yet over-the-air interoperable.**

The upstream Enhanced Sub-GHz Chat app (twisted-pear/esubghz_chat, `esubghz_chat.c`, `tx_msg_input`) writes UTF-8 message bytes followed by CR LF (0D 0A) when encryption is disabled. Its receive path removes a trailing LF before displaying text. `js/chat/momentum-plaintext.js` implements that verified application-level behavior.

The upstream application uses Flipper's `subghz_tx_rx_worker` for physical-layer transmission. Its framing, bit encoding, preamble, sync, modulation, bitrate, deviation, and RX buffering are **not** established by the application-level CRLF convention. We must inspect the worker implementation and verify it against a Flipper-to-YARD Stick capture before connecting this codec to RFCat TX/RX. Sending raw CRLF bytes through RFCat's packet FIFO without matching the worker would be misleading and may not work.

## Hardware acceptance criteria

1. Configure Momentum Enhanced Sub-GHz Chat to **No encryption** and a locally permitted frequency.
2. Match the Flipper worker radio settings on YARD Stick One.
3. Receive a Flipper message in RFCat Web and decode its exact UTF-8 contents.
4. Transmit a message from RFCat Web and see it appear on the Flipper.
5. Repeat bidirectionally, including Unicode and consecutive messages.

Encryption will be implemented only after these tests pass.

Source: https://github.com/twisted-pear/esubghz_chat/blob/main/esubghz_chat.c
