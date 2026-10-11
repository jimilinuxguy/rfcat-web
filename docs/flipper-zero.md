# Flipper Zero TX (initial support)

RFCat Web supports **stock Flipper Zero CLI Princeton 24-bit TX** through Web Serial in desktop Chrome/Edge on HTTPS or localhost. Connect Flipper over USB, close qFlipper/other serial terminals, select **Connect Flipper** in the Flipper TX panel, then enter a 1–6 digit hex key, frequency in MHz, TE in microseconds, and repeat count. Choose internal CC1101 unless you have an external radio attached.

The command sent is `subghz tx <key_hex> <frequency_hz> <te_us> <repeat> <device_0_or_1>`. This is **not** a general raw-byte transmitter. It sends the firmware's Princeton 24-bit encoding and cannot reproduce arbitrary RFCat protocols. The Flipper firmware enforces regional transmit restrictions. The activity log displays serial output, including any firmware rejection. A successful serial write does not itself prove RF transmission.

For arbitrary .sub files, stock firmware provides `subghz tx_from_file`, which requires a compatible file on the Flipper SD card. File transfer and general protocol TX are future work. RX is not yet implemented.

Use only on equipment and frequencies you are authorized to transmit on.
