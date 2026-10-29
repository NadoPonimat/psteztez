/**
 * Генерация иконок лаунчера Android (mipmap) из PWA-иконок PlayZone.
 *  - ic_launcher / ic_launcher_round  <- public/icons/icon-512.png
 *  - ic_launcher_foreground           <- public/icons/icon-maskable-512.png
 *    (у maskable глиф в безопасной зоне — идеально для adaptive-icon foreground)
 *
 * Запуск: bun scripts/make-android-icons.ts
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const RES = path.join(ROOT, "android", "app", "src", "main", "res");

const DENSITIES = [
  ["mdpi", 1],
  ["hdpi", 1.5],
  ["xhdpi", 2],
  ["xxhdpi", 3],
  ["xxxhdpi", 4],
] as const;

/** 48dp базовый размер иконки; 108dp базовый размер foreground-layer */
async function main() {
  for (const [dpi, scale] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${dpi}`);
    mkdirSync(dir, { recursive: true });
    const size = Math.round(48 * scale);
    const src = path.join(ROOT, "public/icons/icon-512.png");
    await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(dir, "ic_launcher.png"));
    await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(dir, "ic_launcher_round.png"));
    const fSize = Math.round(108 * scale);
    const msrc = path.join(ROOT, "public/icons/icon-maskable-512.png");
    await sharp(msrc).resize(fSize, fSize).png({ compressionLevel: 9 }).toFile(path.join(dir, "ic_launcher_foreground.png"));
    console.log(`✓ mipmap-${dpi}: ic_launcher ${size}px, foreground ${fSize}px`);
  }
  console.log("Готово: иконки лаунчера Android созданы.");
}

void main();
