/**
 * Генератор иконок PWA для PlayZone CRM.
 * Создаёт SVG (тёмный фон + изумрудный геймпад, в стиле шапки приложения)
 * и конвертирует его в PNG через sharp.
 *
 * Запуск: bun scripts/make-icons.ts
 */
import sharp from "sharp";
import { mkdirSync, copyFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "icons");
const APP_DIR = path.join(ROOT, "src", "app");

mkdirSync(OUT_DIR, { recursive: true });

const GAMEPAD = `
  <line x1="6" x2="10" y1="11" y2="11"/>
  <line x1="8" x2="8" y1="9" y2="13"/>
  <line x1="15" x2="15.01" y1="12" y2="12"/>
  <line x1="18" x2="18.01" y1="10" y2="10"/>
  <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>
`;

/** Иконка purpose=any: скруглённый квадрат с прозрачными углами */
function iconAny(size: number): string {
  const radius = Math.round(size * 0.19);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3f3f46"/>
      <stop offset="0.55" stop-color="#18181b"/>
      <stop offset="1" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <rect x="0" y="0" width="512" height="512" rx="${radius}" fill="url(#glow)"/>
  <g transform="translate(96 96) scale(13.333)" fill="none" stroke="#34d399"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${GAMEPAD}
  </g>
</svg>`;
}

/** Иконка purpose=maskable: фон на весь квадрат, глиф в безопасной зоне (80%) */
function iconMaskable(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3f3f46"/>
      <stop offset="0.55" stop-color="#18181b"/>
      <stop offset="1" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <g transform="translate(136 136) scale(10)" fill="none" stroke="#34d399"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${GAMEPAD}
  </g>
</svg>`;
}

async function render(svg: string, outPath: string, size: number) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("✓", path.relative(ROOT, outPath));
}

async function main() {
  await render(iconAny(512), path.join(OUT_DIR, "icon-512.png"), 512);
  await render(iconAny(192), path.join(OUT_DIR, "icon-192.png"), 192);
  await render(iconMaskable(), path.join(OUT_DIR, "icon-maskable-512.png"), 512);

  // favicon и apple-touch-icon по файловым конвенциям Next.js (src/app)
  copyFileSync(path.join(OUT_DIR, "icon-512.png"), path.join(APP_DIR, "icon.png"));
  console.log("✓", "src/app/icon.png");
  await render(iconAny(180), path.join(APP_DIR, "apple-icon.png"), 180);

  console.log("Готово: иконки PWA созданы.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
