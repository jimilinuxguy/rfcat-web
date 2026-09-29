# RFCat Web Documentation

This directory contains detailed RFCat Web engineering and protocol
documentation.

## Internals

-   [Developer Guide](../DEVELOPER.md) --- architecture, plugin model,
    ES modules, testing, waveform analysis, and adding protocols.
-   [RFCat USB Protocol](rfcat-usb.md) --- browser-to-RFCat framing and
    commands.
-   [Radio Configuration](radio.md) --- CC1111 radio configuration,
    ASK/OOK PA setup, RX notes, Lowball, and data-rate quantization.

## Protocols

-   [Schrader MRXGG4](protocols/schrader-mrxgg4.md) --- OTA-validated
    Schrader TPMS implementation using `rtl_433` decoder #60.
-   [Schrader EG53MA4](protocols/schrader-eg53ma4.md) --- OTA-validated
    315 MHz Schrader TPMS implementation using `rtl_433` decoder #95.
-   [Schrader SMD3MA4 / NIS315G3](protocols/schrader-smd3ma4.md) --- shared Subaru/Nissan wire format; source-derived, validation pending.
-   [Schrader MRXBC5A4 / BMW](protocols/schrader-mrxbc5a4.md) --- BMW format and integrity logic; source-derived, validation pending.
-   [Acurite 5n1](protocols/acurite-5n1.md) --- OTA validated with
    native `rtl_433` decoder and checksum verification.
-   [Oregon Scientific THGR122NX](protocols/oregon-thgr122nx.md) ---
    experimental weather-sensor implementation.
-   [LRS Pager](protocols/lrs.md) --- packet format and OTA validation
    notes.
-   [Tesla Charge Port](protocols/tesla.md) --- fixed ASK/OOK waveform
    implementation for authorized interoperability testing.
-   [CAME 12-bit](protocols/came12.md) --- experimental OOK encoder.
-   [Generic OOK/PWM](protocols/pwm.md) --- reusable configurable
    pulse-width encoder.
-   [TouchTunes Remote](protocols/touchtunes.md) --- source-derived 433.92 MHz OOK remote encoder; brute-force and jamming functions intentionally excluded.

## Validation Levels

Protocol documents use these broad statuses:

-   **Supported** --- implementation and unit tests are available.
-   **Experimental** --- implementation exists but receiver
    interoperability is not fully established.
-   **Synthetic validated** --- generated samples decode through an
    independent decoder, but an RF transmission has not yet been
    independently received.
-   **OTA validated** --- an independently captured over-the-air
    transmission has been decoded or otherwise matched against the
    expected protocol.

Protocol documentation records known-good test vectors, timing
observations, and RF-specific fixes so implementation decisions do not
have to be rediscovered later.
