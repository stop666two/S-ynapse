#!/usr/bin/env node
// Regenerates the deterministic sample images in media/ used by the build
// test suite (responsive <picture>/WebP pipeline, sharp 0.35 verification).
// Run: node scripts/generate-test-media.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = path.resolve(__dirname, '..', 'media');

function gradientSvg(w, h, from, to, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(w / 12)}" fill="#ffffff" text-anchor="middle">${label}</text>
</svg>`;
}

async function main() {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const jobs = [
    {
      file: 'test-photo-1.jpg', size: 1600, h: 1000,
      render: (w, h) => sharp(Buffer.from(gradientSvg(w, h, '#3b82f6', '#8b5cf6', 'PHOTO-1')))
        .jpeg({ quality: 82 }).toFile(path.join(MEDIA_DIR, 'test-photo-1.jpg'))
    },
    {
      file: 'test-photo-2.png', size: 900, h: 900,
      render: () => sharp({ create: { width: 900, height: 900, channels: 4, background: { r: 245, g: 158, b: 98, alpha: 0.55 } } })
        .png().toFile(path.join(MEDIA_DIR, 'test-photo-2.png'))
    },
    {
      file: 'test-photo-3.webp', size: 1200, h: 800,
      render: (w, h) => sharp(Buffer.from(gradientSvg(w, h, '#10b981', '#06b6d4', 'PHOTO-3')))
        .webp({ quality: 80 }).toFile(path.join(MEDIA_DIR, 'test-photo-3.webp'))
    },
    {
      file: 'test-photo-4.jpg', size: 400, h: 300,
      render: (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 148, g: 163, b: 184 } } })
        .jpeg({ quality: 70 }).toFile(path.join(MEDIA_DIR, 'test-photo-4.jpg'))
    },
    {
      file: 'test-photo-5-large.jpg', size: 3200, h: 2000,
      render: (w, h) => sharp(Buffer.from(gradientSvg(w, h, '#ef4444', '#f59e0b', 'PHOTO-5-LARGE')))
        .jpeg({ quality: 80, progressive: true }).toFile(path.join(MEDIA_DIR, 'test-photo-5-large.jpg'))
    }
  ];
  for (const job of jobs) {
    await job.render(job.size, job.h);
    console.log(`[OK] ${job.file} (${job.size}x${job.h})`);
  }
  console.log('Sample media generated.');
}

main().catch(err => {
  console.error('[FAIL] generate-test-media:', err.message);
  process.exit(1);
});
