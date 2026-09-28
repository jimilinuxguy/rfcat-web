// Experimental waveform encoder. Kept pure so it can be tested without RF hardware.
export function encodeCame12(code, { samplesPerT = 1, repeats = 1, gapT = 47 } = {}) {
  const clean = code.replace(/[\s_]/g, "");
  if (!/^[01]{12}$/.test(clean)) throw new Error("CAME-12 code must contain exactly 12 bits");

  const high = (n) => "1".repeat(n * samplesPerT);
  const low = (n) => "0".repeat(n * samplesPerT);
  let frame = "";

  for (const bit of clean) frame += bit === "0" ? high(1) + low(2) : high(2) + low(1);

  let waveform = "";
  for (let i = 0; i < repeats; i++) {
    waveform += frame;
    if (i < repeats - 1) waveform += low(gapT);
  }

  const meaningfulSymbols = waveform.length;
  const padding = (8 - (waveform.length % 8)) % 8;
  waveform += "0".repeat(padding);

  const bytes = new Uint8Array(waveform.length / 8);
  for (let i = 0; i < waveform.length; i += 8) bytes[i / 8] = parseInt(waveform.slice(i, i + 8), 2);

  return { bytes, code: clean, waveform, meaningfulSymbols, frameSymbols: frame.length, repeats, padding };
}
