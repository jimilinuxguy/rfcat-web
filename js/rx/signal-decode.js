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
  const sortedMedian = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  };
  const highs = pulses.filter(v => v > 0);
  const lows = pulses.filter(v => v < 0).map(Math.abs);
  const highMedian = sortedMedian(highs), lowMedian = sortedMedian(lows);
  if (highMedian !== null) add("PWM width hypothesis", highs.map(v => Number(v > highMedian)));
  if (lowMedian !== null) add("PPM gap hypothesis", lows.map(v => Number(v > lowMedian)));
  for (const inverted of [false, true]) {
    const s = inverted ? symbols.map(v => 1 - v) : symbols;
    for (const phase of [0, 1]) {
      const bits = []; let errors = 0, previous = null;
      for (let i = phase; i + 1 < s.length; i += 2) {
        if (s[i] === s[i + 1]) { errors++; continue; }
        if (previous !== null) bits.push(Number(s[i] === previous));
        previous = s[i];
      }
      add("Differential Manchester phase " + phase + (inverted ? " inverted" : ""), bits, errors);
    }
  }
  return { quality, candidates: candidates.sort((a, b) => b.confidence - a.confidence) };
}

export function compareBitstreams(bitstreams) {
  if (!Array.isArray(bitstreams) || bitstreams.length < 2 ||
      bitstreams.some(v => typeof v !== "string" || !/^[01]*$/.test(v)))
    throw new Error("Expected at least two binary bitstreams");
  const comparedBits = Math.min(...bitstreams.map(v => v.length));
  const changingBitIndices = [];
  for (let i = 0; i < comparedBits; i++) {
    if (bitstreams.some(v => v[i] !== bitstreams[0][i])) changingBitIndices.push(i);
  }
  return { comparedBits, changingBitIndices, lengths: bitstreams.map(v => v.length) };
}

export function alignBitstreams(bitstreams, { maxShift = 128 } = {}) {
  if (!Array.isArray(bitstreams) || bitstreams.length < 2 ||
      bitstreams.some(s => typeof s !== "string" || !/^[01]+$/.test(s)))
    throw new Error("Expected two or more nonempty binary frames");
  const reference = bitstreams[0];
  const aligned = [{ offset: 0, agreement: 1, bitstream: reference }];
  for (const bits of bitstreams.slice(1)) {
    let best = { offset: 0, agreement: -1, overlap: 0 };
    const limit = Math.min(maxShift, Math.max(reference.length, bits.length));
    for (let offset = -limit; offset <= limit; offset++) {
      let matches = 0, overlap = 0;
      for (let i = 0; i < bits.length; i++) {
        const j = i + offset;
        if (j >= 0 && j < reference.length) { overlap++; if (bits[i] === reference[j]) matches++; }
      }
      if (overlap < Math.min(8, reference.length, bits.length)) continue;
      const agreement = matches / overlap;
      if (agreement > best.agreement ||
          (agreement === best.agreement && overlap > best.overlap))
        best = { offset, agreement, overlap };
    }
    aligned.push({ ...best, bitstream: bits });
  }
  const changingBitIndices = [];
  for (let i = 0; i < reference.length; i++) {
    const values = aligned.map(frame => frame.bitstream[i - frame.offset]).filter(v => v !== undefined);
    if (values.length > 1 && new Set(values).size > 1) changingBitIndices.push(i);
  }
  return { aligned, changingBitIndices };
}

export function findPreambleCandidates(bitstream,{minAlternating=8,minRepeats=3}={}){
 if(typeof bitstream!=="string"||!/^[01]*$/.test(bitstream))throw Error("Expected binary bitstream");
 const alternating=[];
 let start=0;
 for(let i=1;i<=bitstream.length;i++){
  if(i<bitstream.length&&bitstream[i]!==bitstream[i-1])continue;
  if(i-start>=minAlternating)alternating.push({start,length:i-start,pattern:bitstream.slice(start,Math.min(i,start+16))});
  start=i;
 }
 const syncCandidates=[];
 for(const width of [8,16,24,32]){
  const counts=new Map();
  for(const hit of alternating){
   const value=bitstream.slice(hit.start+hit.length,hit.start+hit.length+width);
   if(value.length===width)counts.set(value,(counts.get(value)??0)+1);
  }
  for(const [bits,count] of counts)if(count>=minRepeats)syncCandidates.push({bits,width,count,verified:false});
 }
 return {alternating,syncCandidates,verified:false};
}
