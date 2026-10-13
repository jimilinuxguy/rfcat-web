// Pure, hardware-independent analysis of demodulated RF pulse captures.
// Durations are signed integer microseconds; sign denotes logic level.
export function parseFlipperRaw(text) {
  if (typeof text !== "string") throw new TypeError("Expected .sub text");
  const metadata = {};
  const pulses = [];
  let sawRaw = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([^:]+):\s*(.*)$/.exec(trimmed);
    if (!match) throw new Error("Malformed .sub line: " + trimmed.slice(0, 80));
    const [, key, value] = match;
    if (key === "RAW_Data") {
      sawRaw = true;
      const values = value.trim().split(/\s+/);
      if (!value.trim() || values.some(v => !/^[+-]?\d+$/.test(v))) throw new Error("Invalid RAW_Data");
      for (const v of values) {
        const n = Number(v);
        if (!Number.isSafeInteger(n) || n === 0) throw new Error("Invalid pulse duration");
        if (pulses.length >= 250000) throw new Error("RAW capture exceeds 250000 pulse limit");
        pulses.push(n);
      }
    } else metadata[key] = value;
  }
  if (metadata.Protocol !== "RAW" || !sawRaw || !pulses.length) throw new Error("Expected Flipper RAW capture");
  if (!/^\d+$/.test(metadata.Frequency ?? "") || !Number.isSafeInteger(Number(metadata.Frequency)) || Number(metadata.Frequency) <= 0) throw new Error("Invalid frequency");
  return {
    source: "flipper-sub-raw",
    frequencyHz: Number(metadata.Frequency),
    configuredPreset: metadata.Preset ?? null,
    configuredModulation: /ook|am/i.test(metadata.Preset ?? "") ? "ASK/OOK" : /fsk|fm/i.test(metadata.Preset ?? "") ? "FSK" : null,
    verifiedModulation: null,
    metadata: { ...metadata },
    durationsUs: pulses,
    originalText: text
  };
}
export function normalizePulseCapture({ source = "rfcat", frequencyHz = null, durationsUs, metadata = {}, configuredModulation = null }) {
  if (!Array.isArray(durationsUs) || !durationsUs.length || durationsUs.length > 250000 || durationsUs.some(n => !Number.isSafeInteger(n) || n === 0)) throw new Error("Invalid signed microsecond durations");
  return { source, frequencyHz, durationsUs: [...durationsUs], metadata: { ...metadata }, configuredModulation, verifiedModulation: null };
}
function median(xs) {
  const sorted = [...xs].sort((a,b)=>a-b);
  return sorted.length ? (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.floor(sorted.length/2)])/2 : null;
}
export function analyzePulses(capture) {
  const pulses = capture.durationsUs;
  if (!Array.isArray(pulses) || !pulses.length) throw new Error("Empty capture");
  const abs = pulses.map(Math.abs);
  const baseUs = median(abs.filter(v => v <= median(abs))) ?? median(abs);
  const tolerance = Math.max(10, baseUs * 0.22);
  const clusters = [];
  for (const value of [...abs].sort((a,b)=>a-b)) {
    const group = clusters.find(c => Math.abs(c.center-value) <= tolerance);
    if (group) { group.values.push(value); group.center = median(group.values); }
    else clusters.push({ center: value, values: [value] });
  }
  const gaps = pulses.flatMap((value,index) => value < 0 && Math.abs(value) >= Math.max(5000, baseUs*6) ? [{ index, durationUs: -value }] : []);
  const frames = [];
  let start = 0;
  for (const gap of gaps) {
    if (gap.index > start) frames.push(pulses.slice(start,gap.index));
    start = gap.index+1;
  }
  if (start < pulses.length) frames.push(pulses.slice(start));
  const stable = abs.filter(v => Math.abs(v/baseUs-Math.round(v/baseUs))*baseUs <= tolerance).length / abs.length;
  const candidates = [
    { encoding:"NRZ", confidence: Math.round(stable*65), evidence:["Pulse lengths near integer multiples of estimated unit"], limitations:["Level polarity and bit alignment unknown"] },
    { encoding:"Manchester", confidence: Math.round(stable*45), evidence:["Timing quantization compatible with half-bit intervals"], limitations:["Transitions alone do not verify Manchester"] },
    { encoding:"Differential Manchester", confidence: Math.round(stable*40), evidence:["Timing quantization permits transition encoding"], limitations:["Initial state and phase unknown"] },
    { encoding:"PWM", confidence: clusters.length >= 2 ? 45 : 15, evidence:["Multiple duration clusters may represent width symbols"], limitations:["No symbol framing verified"] },
    { encoding:"PPM", confidence: clusters.length >= 2 ? 40 : 15, evidence:["Variable spaces may represent position symbols"], limitations:["No symbol framing verified"] }
  ].sort((a,b)=>b.confidence-a.confidence);
  return {
    configuredModulation: capture.configuredModulation ?? null,
    verifiedModulation: null,
    modulationFinding: "Undetermined from demodulated pulse timing",
    estimatedUnitUs: baseUs,
    estimatedSymbolRate: baseUs ? Math.round(1e6/baseUs) : null,
    bitrateStatus: "heuristic; unit duration is not necessarily a bit period",
    timingConsistency: stable,
    clusters: clusters.map(c=>({ centerUs:c.center, count:c.values.length })),
    gaps, frames: frames.map((durationsUs,index)=>({ index, durationsUs })),
    candidates,
    warnings:["ASK/OOK and FSK can produce identical demodulated pulse trains", "Receiver preset does not independently verify transmitted modulation"]
  };
}
export function comparePulseCaptures(captures) {
  if (!Array.isArray(captures) || captures.length < 2) throw new Error("Need at least two captures");
  const analyses = captures.map(analyzePulses);
  return { analyses, frameCount: analyses.map(a=>a.frames.length), timingConsistency: analyses.map(a=>a.timingConsistency), modulationVerified: false };
}
