import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The transparent skillet is the source for every app icon.
const publicDirectory = new URL('../public/', import.meta.url);
const mark = await readFile(new URL('omnicook-mark.svg', publicDirectory), 'utf8');
const withBackground = (radius = 0) => mark.replace(
  /(<svg\b[^>]*>)/,
  `$1\n  <rect width="512" height="512" rx="${radius}" fill="#f9d94e"/>`,
);

await writeFile(new URL('omnicook-icon.svg', publicDirectory), withBackground(112));
for (const [filename, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  // Full-bleed backgrounds let each OS apply its own home-screen mask.
  await sharp(Buffer.from(withBackground())).resize(size, size).png()
    .toFile(fileURLToPath(new URL(filename, publicDirectory)));
  console.log(`${filename}: ${size} × ${size}`);
}
