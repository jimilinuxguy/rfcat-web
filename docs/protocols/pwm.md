# Generic OOK/PWM

**Status: Supported**

The generic OOK/PWM encoder provides a reusable way to translate logical
bits into configurable HIGH/LOW RF symbol sequences.

It is useful both as a standalone transmitter and as a foundation for
protocol development.

## Encoder

The reusable encoder accepts logical bits plus timing ratios for zero
and one.

Example:

``` text
0 -> 1 HIGH + 3 LOW
1 -> 3 HIGH + 1 LOW
```

becomes:

``` text
0 -> 1000
1 -> 1110
```

## Known-Answer Test

Logical bits:

``` text
01
```

produce:

``` text
10001110
```

which packs MSB-first to:

``` text
0x8E
```

## UI Fields

The generic protocol exposes:

-   logical bit string
-   frequency
-   RF symbol rate
-   zero HIGH length
-   zero LOW length
-   one HIGH length
-   one LOW length
-   repetition count

## Radio Configuration

The generic protocol uses:

``` text
ASK/OOK
hardware sync disabled
hardware Manchester disabled
```

and configures the ASK/OOK PA through the device helper.

## Example Bench Test

Using:

``` text
bits:        01010101
frequency:   433.920 MHz
symbol rate: 3125
0:           1H / 3L
1:           3H / 1L
```

produces:

``` text
8E 8E 8E 8E
```

At 1 MS/s, the nominal symbol length is approximately:

``` text
320 samples/symbol
```

A trailing LOW can be visually merged into the following pause by an SDR
analyzer; this does not necessarily indicate a missing encoded symbol.

## Reuse

Protocol modules should use the generic PWM helper when their waveform
can be described cleanly by fixed HIGH/LOW symbol counts.

Protocols with unusual framing or gap semantics may implement their own
waveform construction while still using shared byte/bit utilities.
