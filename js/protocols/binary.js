export function parseBinarySymbols(value) {
  const clean = value.replace(/[\s_]/g, "");
  if (!clean.length) throw new Error("Enter a binary OOK symbol stream");
  if (/[^01]/.test(clean)) throw new Error("Binary OOK symbols may contain only 0 and 1");
  if (clean.length % 8 !== 0) {
    throw new Error(`OOK symbol count must be byte-aligned (multiple of 8). Got ${clean.length} symbols.`);
  }
  const bytes = new Uint8Array(clean.length / 8);
  for (let i = 0; i < clean.length; i += 8) bytes[i / 8] = parseInt(clean.slice(i, i + 8), 2);
  return { bytes, symbols: clean.length, bits: clean };
}
