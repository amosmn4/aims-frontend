// One-off generator for public/icons/* from the Amsol logo — `sharp` isn't a saved dependency
// (kept out of package.json since nothing at runtime needs it), so `npm install sharp` before
// re-running this if the source logo ever changes.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "public/amsol-logo.png";
const OUT_DIR = "public/icons";

mkdirSync(OUT_DIR, { recursive: true });

async function makeIcon({ file, size, padRatio, background }) {
  const logoSize = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${OUT_DIR}/${file}`);
  console.log(`wrote ${OUT_DIR}/${file}`);
}

// The source logo's "background" pixels are an opaque cream fill, not true transparency (it's
// always wrapped in a white card everywhere it's used in-app) — white matches that convention
// and blends seamlessly, where navy would show as a mismatched rectangle around the logo.
const white = { r: 255, g: 255, b: 255, alpha: 1 };

await makeIcon({ file: "icon-192.png", size: 192, padRatio: 0.14, background: white });
await makeIcon({ file: "icon-512.png", size: 512, padRatio: 0.14, background: white });
// Maskable icons need extra safe-zone padding (~20%) since the OS may crop to a circle/squircle.
await makeIcon({ file: "icon-maskable-192.png", size: 192, padRatio: 0.22, background: white });
await makeIcon({ file: "icon-maskable-512.png", size: 512, padRatio: 0.22, background: white });
// Apple touch icon: no transparency, solid background, no extra rounding (iOS applies its own).
await makeIcon({ file: "apple-touch-icon.png", size: 180, padRatio: 0.12, background: white });
await makeIcon({ file: "icon-32.png", size: 32, padRatio: 0.08, background: white });
await makeIcon({ file: "icon-16.png", size: 16, padRatio: 0.05, background: white });

console.log("done");
