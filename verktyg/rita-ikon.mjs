/* ============================================================
   Ritar Kvarios ikon och kodar den som PNG

   Motivet är samma bild som stapeln i appen: pengarna som kommer
   in, uppdelade i band, där den nedersta delen — den som faktiskt
   är dina — lyser i mässing.

   PNG skrivs för hand i stället för med bildbibliotek. En PNG är i
   grunden bara zlib-packade rader med en filterbyte först på varje
   rad, och då slipper projektet ett beroende till.
   ============================================================ */

import { deflateSync } from "node:zlib";

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const INK = hex("#131E26");
const BAND = [hex("#3E5566"), hex("#63798A"), hex("#8A9CA8")];
const BRASS = hex("#B8862B");

const CRC_TABELL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = CRC_TABELL[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(typ, data) {
  const langd = Buffer.alloc(4);
  langd.writeUInt32BE(data.length);
  const kropp = Buffer.concat([Buffer.from(typ, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(kropp));
  return Buffer.concat([langd, kropp, crc]);
}

/* utanAlfa skriver RGB i stället för RGBA. Apple avvisar app-ikoner
   som har en alfakanal, även när varenda pixel är ogenomskinlig — det
   är kanalens blotta närvaro som fälls. */
function skrivPng(bredd, hojd, pixlar, utanAlfa = false) {
  const kanaler = utanAlfa ? 3 : 4;
  const rader = [];
  for (let y = 0; y < hojd; y++) {
    rader.push(Buffer.from([0]));  // filter: none
    const rad = pixlar.subarray(y * bredd * 4, (y + 1) * bredd * 4);
    if (!utanAlfa) { rader.push(Buffer.from(rad)); continue; }
    const utan = Buffer.alloc(bredd * 3);
    for (let x = 0; x < bredd; x++) {
      utan[x * 3] = rad[x * 4];
      utan[x * 3 + 1] = rad[x * 4 + 1];
      utan[x * 3 + 2] = rad[x * 4 + 2];
    }
    rader.push(utan);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bredd, 0);
  ihdr.writeUInt32BE(hojd, 4);
  ihdr[8] = 8;                      // bitar per kanal
  ihdr[9] = kanaler === 3 ? 2 : 6;  // 2 = RGB, 6 = RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rader), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* maskable = true används för adaptiva ikoner och Androids
   foreground-lager: systemet beskär till cirkel eller squircle, så
   motivet krymps och hörnen lämnas raka.

   egenMarginal går att skicka med när beskärningen är känd och
   mindre aggressiv. En profilbild beskärs till cirkel, som behåller
   ungefär 70 procent av bredden — då blir maskable-marginalen på
   29 procent alldeles för tilltagen och märket ser borttappat ut. */
export function ritaIkon(storlek, maskable, egenMarginal = null, utanAlfa = false) {
  const px = new Uint8Array(storlek * storlek * 4);
  const satt = (x, y, [r, g, b], a = 255) => {
    const i = (y * storlek + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };

  const andel = egenMarginal ?? (maskable ? 0.29 : 0.17);
  const marginal = storlek * andel;
  const radie = maskable ? 0 : storlek * 0.22;
  const inner = storlek - marginal * 2;

  const delar = [0.20, 0.13, 0.12, 0.55];
  const farger = [BAND[0], BAND[1], BAND[2], BRASS];
  const gluggPx = Math.max(1, Math.round(storlek * 0.012));

  for (let y = 0; y < storlek; y++) {
    for (let x = 0; x < storlek; x++) {
      let iBakgrund = true;
      if (radie > 0) {
        const nx = Math.min(x, storlek - 1 - x);
        const ny = Math.min(y, storlek - 1 - y);
        if (nx < radie && ny < radie) {
          const dx = radie - nx, dy = radie - ny;
          if (dx * dx + dy * dy > radie * radie) iBakgrund = false;
        }
      }
      if (!iBakgrund) { satt(x, y, INK, 0); continue; }
      satt(x, y, INK);

      if (x >= marginal && x < marginal + inner) {
        const relY = (y - marginal) / inner;
        if (relY >= 0 && relY < 1) {
          let ack = 0;
          for (let i = 0; i < delar.length; i++) {
            const nasta = ack + delar[i];
            if (relY >= ack && relY < nasta) {
              const yPos = marginal + relY * inner;
              const bandSlut = marginal + nasta * inner;
              // Glugg mellan banden gör dem läsbara i litet format
              if (i < delar.length - 1 && bandSlut - yPos < gluggPx) break;
              satt(x, y, farger[i]);
              break;
            }
            ack = nasta;
          }
        }
      }
    }
  }
  return skrivPng(storlek, storlek, px, utanAlfa);
}
