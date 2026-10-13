// Hypotheses derived from demodulated pulses; not verified modulation.
export function decodeHypotheses(pulses, unitUs, maxBits = 16384) {
  if (!Array.isArray(pulses) || !Number.isFinite(unitUs) || unitUs <= 0 ||
      pulses.some(v => !Number.isSafeInteger(v) || v === 0)) throw new Error("Invalid pulse timing");
  const symbols = [];
  let error = 0;
  for (const duration of pulses) {
    const exact = Math.abs(duration) / unitUs;
    const count = Math.round(exact);
    if (count < 1 || symbols.length + count > maxBits) throw new Error("Decode limit exceeded");
    error += Math.abs(exact - count);
    for (let i = 0; i < count; i++) symbols.push(duration > 0 ? 1 : 0);
  }
  const quality = Math.max(0, 1 - error / Math.max(1, pulses.length));
  const candidates = [];
  function add(encoding, bits, errors = 0) {
    candidates.push({ encoding, bits: bits.join(""),
      confidence: Math.min(85, Math.round(100 * quality * (1 - errors / Math.max(1, bits.length)))),
      errors, verified: false });
  }
  for (const inverted of [false, true]) {
    const s = inverted ? symbols.map(v => 1 - v) : symbols;
    add(inverted ? "NRZ inverted" : "NRZ", s);
    for (const phase of [0, 1]) {
      const decoded = []; let errors = 0;
      for (let i = phase; i + 1 < s.length; i += 2) {
        if (s[i] === s[i + 1]) errors++;
        decoded.push(s[i]);
      }
      add("Manchester phase " + phase + (inverted ? " inverted" : ""), decoded, errors);
    }
  }
  return { quality, candidates: candidates.sort((a, b) => b.confidence - a.confidence) };
}
