---
title: Local Image Pipeline Test
slug: media-pipeline
tags: ["image", "optimization", "webp", "responsive"]
categories: ["tech", "tutorial"]
description: "Verifies the sharp 0.35 media optimization pipeline: WebP conversion, multi-size responsive <picture>, lazy loading and cache busting"
date: 2026-08-15 14:00
featuredImage: "/media/test-photo-1.jpg"
---

# Local Image Pipeline Test

This article references five procedurally generated images under `media/` to verify the build-time media optimization pipeline: sharp conversion, WebP variants, multi-size srcset, lazy loading, and image cache busting.

## Responsive Image 1 (JPG source, large)

![Test image 1 - Large JPG](/media/test-photo-1.jpg)

## Transparent PNG (alpha channel)

![Test image 2 - Transparent PNG](/media/test-photo-2.png)

## Native WebP Source

![Test image 3 - WebP source](/media/test-photo-3.webp)

## Small JPG

![Test image 4 - Small image](/media/test-photo-4.jpg)

## Extra-Large Image (3200×2000, triggers the 1920 breakpoint)

![Test image 5 - Extra-large image](/media/test-photo-5-large.jpg)

## Expected Behavior

- Each image generates a `<picture>` structure with WebP source(s)
- `media-manifest.json` records variants at 640/1024/1920 sizes
- All images carry `loading="lazy"` (unless lazyLoadImages is disabled)
- After conversion, `.webp` variant files appear under dist/media/
- After cache busting, HTML references MD5-hashed filenames
