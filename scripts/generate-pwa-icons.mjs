// One-off PWA icon generator — run with `node scripts/generate-pwa-icons.mjs`.
// Reuses the existing app/icon.svg (mauve bg + white "M") design; the
// maskable variant redraws the same glyph with extra safe-zone padding so
// Android's circular/squircle crop doesn't clip it.
import sharp from "sharp";
import { writeFileSync } from "fs";

const BRAND = "#9e7676";
const M_PATH = "M18 82V18h16l16 38 16-38h16v64h-14V40l-14 34h-8L32 40v42z";

const anySvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="${BRAND}"/>
  <path fill="#FFFFFF" d="${M_PATH}"/>
</svg>`;

// Full-bleed background (no rounding — the OS applies its own mask shape),
// glyph translated into a larger virtual canvas so it occupies ~40% of the
// icon instead of ~64%, safely inside the ~80%-diameter safe-zone circle.
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
  <rect width="160" height="160" fill="${BRAND}"/>
  <g transform="translate(30,30)">
    <path fill="#FFFFFF" d="${M_PATH}"/>
  </g>
</svg>`;

async function render(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`wrote ${outPath}`);
}

await render(anySvg, 192, "public/icons/icon-192.png");
await render(anySvg, 512, "public/icons/icon-512.png");
await render(maskableSvg, 512, "public/icons/icon-maskable-512.png");
