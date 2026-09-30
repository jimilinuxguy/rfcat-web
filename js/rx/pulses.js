export function bytesToPulseRuns(bytes, dataRate, { maxRuns = 4096 } = {}) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("bytes must be a Uint8Array");
    if (!Number.isFinite(dataRate) || dataRate <= 0) throw new RangeError("dataRate must be positive");
    const symbolUs = 1e6 / dataRate;
    const runs = [];
    let level = null;
    let symbols = 0;
    for (const byte of bytes) {
        for (let bit = 7; bit >= 0; bit--) {
            const next = (byte >> bit) & 1;
            if (level === null) { level = next; symbols = 1; continue; }
            if (next === level) { symbols++; continue; }
            runs.push({ level, symbols, durationUs: symbols * symbolUs });
            if (runs.length >= maxRuns) return runs;
            level = next;
            symbols = 1;
        }
    }
    if (level !== null && runs.length < maxRuns) runs.push({ level, symbols, durationUs: symbols * symbolUs });
    return runs;
}

export function pulseDistribution(runs, { tolerance = 0.18 } = {}) {
    const groups = [];
    for (const run of runs) {
        let best = null;
        let error = Infinity;
        for (const group of groups) {
            const e = Math.abs(run.durationUs - group.meanUs) / group.meanUs;
            if (e <= tolerance && e < error) { best = group; error = e; }
        }
        if (!best) {
            groups.push({ count: 1, meanUs: run.durationUs, minUs: run.durationUs, maxUs: run.durationUs });
        } else {
            best.meanUs = (best.meanUs * best.count + run.durationUs) / (best.count + 1);
            best.count++;
            best.minUs = Math.min(best.minUs, run.durationUs);
            best.maxUs = Math.max(best.maxUs, run.durationUs);
        }
    }
    return groups.sort((a, b) => a.meanUs - b.meanUs);
}

export function estimateBasePulse(groups) {
    const useful = groups.filter((g) => g.count >= 2);
    if (!useful.length) return null;
    return useful.reduce((best, g) => g.meanUs < best.meanUs ? g : best).meanUs;
}
