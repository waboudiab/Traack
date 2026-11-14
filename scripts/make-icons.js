import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const PURPLE = [59, 7, 100, 255];
const GOLD = [232, 200, 114, 255];

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function insideRound(x, y, size, radius) {
  const inset = radius;
  if (x < inset && y < inset) return Math.hypot(inset - x, inset - y) <= radius;
  if (x > size - inset && y < inset) return Math.hypot(x - (size - inset), inset - y) <= radius;
  if (x < inset && y > size - inset) return Math.hypot(inset - x, y - (size - inset)) <= radius;
  if (x > size - inset && y > size - inset) return Math.hypot(x - (size - inset), y - (size - inset)) <= radius;
  return true;
}

function png(size, { bleed }) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const radius = Math.round(size * 0.22);
  const arm = size * 0.16;
  const thick = Math.max(4, Math.round(size * 0.07));
  const stem = Math.max(4, Math.round(size * 0.075));
  const top = Math.round(size * 0.34);
  const bottom = Math.round(size * 0.68);
  const mid = size / 2;
  for (let y = 0; y < size; y += 1) {
    pixels[(size * 4 + 1) * y] = 0;
    for (let x = 0; x < size; x += 1) {
      const onIcon = bleed || insideRound(x, y, size, radius);
      let color = onIcon ? PURPLE : [0, 0, 0, 0];
      const onBar = y >= top && y < top + thick && x >= mid - arm && x <= mid + arm;
      const onStem = x >= mid - stem / 2 && x <= mid + stem / 2 && y >= top && y <= bottom;
      if (onIcon && (onBar || onStem)) color = GOLD;
      const offset = (size * 4 + 1) * y + 1 + x * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("public/icons/icon-192.png", png(192, { bleed: false }));
writeFileSync("public/icons/icon-512.png", png(512, { bleed: false }));
writeFileSync("public/icons/icon-512-maskable.png", png(512, { bleed: true }));
writeFileSync("public/icons/apple-touch-icon.png", png(180, { bleed: true }));
console.log("icons written");
