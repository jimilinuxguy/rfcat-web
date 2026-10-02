# RFCat USB Protocol

RFCat Web implements the RFCat USB transport directly in JavaScript over
WebUSB.

## Tested Hardware

The primary test device is the YARD Stick One / CC1111.

``` text
VID: 0x1D50
PID: 0x605B
```

The RFCat USB bulk endpoints used by the application are:

``` text
OUT endpoint: 5
IN endpoint:  0x85
```

## Outbound Frame

RFCat commands are sent as:

``` text
APP
CMD
LEN_LO
LEN_HI
PAYLOAD...
```

or conceptually:

``` text
app + cmd + uint16LE(payload length) + payload
```

## Inbound Frame

Responses are framed as:

``` text
0x40
APP
CMD
LEN_LO
LEN_HI
PAYLOAD...
```

## Applications

``` text
APP_SYSTEM = 0xFF
APP_NIC    = 0x42
```

## System Commands

``` text
SYS_PEEK    = 0x80
SYS_POKE    = 0x81
SYS_PING    = 0x82
SYS_RFMODE  = 0x88
SYS_PARTNUM = 0x8E
```

## NIC Commands

``` text
NIC_RECV         = 0x01
NIC_XMIT         = 0x02
NIC_SET_AMP_MODE = 0x0A
```

## RF Modes

``` text
RF_RX   = 0x02
RF_TX   = 0x03
RF_IDLE = 0x04
```

## NIC_XMIT Payload

The current transmission method builds:

``` text
uint16LE(data length)
uint16LE(repeat)
uint16LE(offset)
data...
```

The device abstraction validates that the transmitted data is a
non-empty `Uint8Array` and fits within the supported RFCat payload size.

The raw RFCat repeat field remains part of this transport framing, but pager protocols do not rely on firmware repeat behavior. POCSAG, JTECH, and LRS implement their UI repeat count host-side by issuing separate NIC_XMIT operations with the firmware repeat field set to zero.

## Command/Response Matching

RFCat Web waits for the expected application and command response rather
than treating arbitrary USB input as the response to the current
request.

On connect, RFCat Web resets the WebUSB device, clears stale transport state, starts the receive loop, allows stale endpoint data to drain briefly, and retries the initial ping up to three times. This behavior was added to make disconnect/reload/reconnect reliable on the tested YARD Stick One.

## RX Consideration

Once the radio is placed into active RX mode, avoid issuing register
peek/poke traffic until reception is stopped. Such traffic has been
observed to interfere with receive operation.

## Design Rule

Protocol modules should not construct raw USB frames. They should call
methods on `js/rfcat/device.js`.

This keeps USB/RFCat transport behavior independent from RF protocol
encoding.
