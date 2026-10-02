# Radio Configuration

This document records CC1111/YARD Stick One radio configuration details
that are important to RFCat Web.

## Register Definitions

Relevant register addresses currently include:

``` text
SYNC1     0xDF00
SYNC0     0xDF01
PKTLEN    0xDF02
PKTCTRL1  0xDF03
PKTCTRL0  0xDF04
ADDR      0xDF05
FREQ2     0xDF09
MDMCFG4   0xDF0C
MDMCFG3   0xDF0D
MDMCFG2   0xDF0E
DEVIATN   0xDF11
FREND1    0xDF1A
FREND0    0xDF1B
FSCAL2    0xDF1D
TEST2     0xDF23
TEST1     0xDF24
PATABLE   0xDF2D
LQI       0xDF39
RSSI      0xDF3A
MARCSTATE 0xDF3B
```

## ASK/OOK PA Configuration

A known-working ASK/OOK configuration is:

``` text
PATABLE[0] = 0xC0
FREND0     = 0x11
```

The PATABLE base address is:

``` text
0xDF2D
```

An earlier `0xDF2E` address was incorrect and resulted in bad ASK/OOK
behavior.

ASK/OOK protocols should use the dedicated `configureAskOokPa()` device
helper rather than the generic `setMaxPower()` path.

## External Amplifier

Protocols that need the YARD Stick One external amplifier should enable
it only around transmission.

Use cleanup in `finally` so an encoder or USB error does not leave the
amplifier enabled unintentionally.

## Lowball RX

Lowball follows upstream RFCat semantics rather than writing status registers directly. The current implementation configures:

```text
fixed packet length: 250 bytes
CRC:                 off
FEC:                 off
data whitening:      off
sync word:           0xAAAA
PQT:                 0
sync mode:           carrier sense
```

It updates the relevant packet/sync fields while preserving unrelated register bits. In particular, it does not write RSSI or other read-only/status values as configuration.

Lowball is intended as an optional/manual RX configuration. Do not apply Lowball to normal TX operation.

## RX Register Access

After entering RX mode, do not continuously poll radio registers.

Register reads while listening have been observed to disrupt reception.

Configure the radio first, enter RX, receive packets, then return to
idle before performing diagnostic register access.

## Frequency Units

The browser UI represents frequency in MHz where appropriate.

The device method `setFrequency()` expects Hz.

A protocol converting a UI MHz value should therefore use:

``` javascript
await device.setFrequency(values.frequency * 1_000_000);
```

Hard-coded protocol frequencies should normally be represented directly
in Hz:

``` javascript
await device.setFrequency(433_920_000);
```

## Data Rate Quantization

Requested data rates may be quantized by the CC1111 register
representation.

For example, the Acurite implementation requests approximately:

``` text
9800 baud
```

with a measured/read-back value around:

``` text
9796 baud
```

This is expected.

## Waveform Timing Analysis

`js/encoding/waveform.js` mirrors the CC1111 data-rate quantization used by `RFCatUSB.setDataRate()`. This allows the browser to preview the actual representable symbol rate and pulse timing before transmission without accessing the radio.

The RF Waveform Preview compares requested pulse durations with durations produced by the quantized CC1111 symbol period. These values are predictions from the same register calculation and should still be independently measured with an SDR when validating a new protocol.
