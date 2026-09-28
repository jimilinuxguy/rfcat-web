export const u16 = (n) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);

export function concat(...arrays) {
  const size = arrays.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const item of arrays) {
    output.set(item, offset);
    offset += item.length;
  }
  return output;
}

export const hex = (bytes) =>
  [...bytes].map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");

export const text = (bytes) => new TextDecoder().decode(bytes).replace(/\0/g, "");

export function parseHex(value) {
  const clean = value.replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2) throw new Error("Hex payload must contain complete bytes");
  return new Uint8Array(clean.match(/.{2}/g)?.map((x) => parseInt(x, 16)) || []);
}
