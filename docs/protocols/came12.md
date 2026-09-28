# CAME 12-bit

**Status: Experimental**

RFCat Web includes an experimental CAME-style 12-bit OOK waveform
encoder for authorized laboratory and interoperability testing.

## Encoding

Current mapping:

``` text
0 -> 100
1 -> 110
```

With base interval `T`:

``` text
0 -> HIGH T  + LOW 2T
1 -> HIGH 2T + LOW T
```

Current base timing is approximately:

``` text
T ≈ 320 µs
```

corresponding to approximately:

``` text
3125 RF symbols/sec
```

## Framing

The current implementation generates three bursts with an inter-frame
LOW gap based on:

``` text
31T
```

## Known Test Vector

For:

``` text
101001011010
```

the encoder produces:

``` text
176 RF symbols
22 bytes
```

Known packed output:

``` text
D3 49 A6 D3 40 00 00 00
1A 69 34 DA 68 00 00 00
03 4D 26 9B 4D 00
```

## Implementation Note

The CAME encoder currently constructs its own complete waveform rather
than using the generic PWM encoder because its framing/gap requirements
differ from the generic representation.

## Status

The encoder has known-answer tests and RF development testing, but it
remains marked experimental rather than being presented as universally
compatible with CAME receivers.
