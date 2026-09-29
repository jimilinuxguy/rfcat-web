/** Pure helpers for describing, packing, and timing binary RF waveforms. */
export function packWaveform(waveform) {
    waveform = String(waveform ?? "").replace(/\s/g, "");
    if (!/^[01]*$/.test(waveform)) throw new Error("Waveform may contain only 0 and 1");
    const padding = (8 - (waveform.length % 8)) % 8;
    const padded = waveform + "0".repeat(padding);
    const bytes = new Uint8Array(padded.length / 8);
    for (let i = 0; i < padded.length; i += 8) bytes[i / 8] = parseInt(padded.slice(i, i + 8), 2);
    return { bytes, waveform, symbols: waveform.length, padding };
}


export function bytesToBits(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("Expected Uint8Array");
    let bits = "";
    for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
    return bits;
}

/** Match the CC1111 data-rate calculation used by RFCatUSB.setDataRate(). */
export function quantizeCc1111DataRate(requestedRate, crystalHz = 24_000_000) {
    const requested = Number(requestedRate);
    if (!Number.isFinite(requested) || requested <= 0) throw new Error("Symbol rate must be positive");
    for (let exponent = 0; exponent < 16; exponent++) {
        const mantissa = Math.round((requested * 2 ** 28) / (2 ** exponent * crystalHz) - 256);
        if (mantissa < 256) {
            if (mantissa < 0) break;
            const actual = ((256 + mantissa) * 2 ** exponent * crystalHz) / 2 ** 28;
            return { requested, actual, exponent, mantissa, symbolPeriodUs: 1_000_000 / actual,
                errorPercent: ((actual - requested) / requested) * 100 };
        }
    }
    throw new Error("Unsupported CC1111 symbol rate");
}

export function pulseTiming(symbols, symbolPeriodUs, requestedUs = null) {
    const actualUs = Number(symbols) * Number(symbolPeriodUs);
    return {
        symbols: Number(symbols), requestedUs, actualUs,
        errorUs: requestedUs == null ? null : actualUs - requestedUs,
        errorPercent: requestedUs == null ? null : ((actualUs - requestedUs) / requestedUs) * 100,
    };
}

export function waveformRuns(waveform) {
    waveform = String(waveform ?? "");
    if (!waveform) return [];
    const runs = [];
    let level = waveform[0], start = 0;
    for (let i = 1; i <= waveform.length; i++) {
        if (i === waveform.length || waveform[i] !== level) {
            runs.push({ level: Number(level), start, symbols: i - start });
            if (i < waveform.length) { level = waveform[i]; start = i; }
        }
    }
    return runs;
}

export function buildWaveformAnalysis({ waveform, symbolRate, requestedTimings = [], label = "RF waveform" }) {
    const rate = quantizeCc1111DataRate(symbolRate);
    return {
        label,
        requestedSymbolRate: Number(symbolRate), actualSymbolRate: rate.actual,
        symbolPeriodUs: rate.symbolPeriodUs, rateErrorPercent: rate.errorPercent,
        symbols: waveform.length, durationUs: waveform.length * rate.symbolPeriodUs,
        runs: waveformRuns(waveform),
        timings: requestedTimings.map(t => ({ name: t.name, ...pulseTiming(t.symbols, rate.symbolPeriodUs, t.requestedUs) })),
    };
}
