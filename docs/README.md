# RFCat Web Documentation

This directory contains detailed RFCat Web engineering and protocol
documentation.

## Internals

-   [Developer Guide](../DEVELOPER.md) --- architecture, plugin model,
    ES modules, testing, and adding protocols.
-   [RFCat USB Protocol](rfcat-usb.md) --- browser-to-RFCat framing and
    commands.
-   [Radio Configuration](radio.md) --- CC1111 radio configuration,
    ASK/OOK PA setup, RX notes, and Lowball.

## Protocols

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

## Validation Levels

Protocol documents use these broad statuses:

-   **Supported** --- implementation and unit tests are available.
-   **Experimental** --- implementation exists but receiver
    interoperability is not fully established.
-   **OTA validated** --- an independently captured over-the-air
    transmission has been decoded or otherwise matched against the
    expected protocol.

Protocol documentation records known-good test vectors and RF
observations so implementation decisions do not have to be rediscovered
later.
