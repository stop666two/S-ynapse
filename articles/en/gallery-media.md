---
title: Media Gallery & Image Pipeline
slug: gallery-media
date: 2026-09-02 16:20:00
tags: [images, media, test]
categories: [tech]
description: Rendering, lazy loading, lightbox zoom and generated variants across five image formats (JPG/PNG/WebP/large JPG).
featuredImage: /media/test-photo-2.png
---

# Media Gallery & Image Pipeline

This page arranges every asset under `media/` into a gallery and checks each one: **scaling and rounding**, **lazy-loading attributes**, **lightbox zoom**, **caption alignment**, and whether the build-time **WebP/AVIF variants** are correctly referenced via `<picture>`.

## Asset Overview

| File | Format | Purpose | What to check |
| --- | --- | --- | --- |
| test-photo-1.jpg | JPG | landscape photo | basic rendering and lightbox |
| test-photo-2.png | PNG | UI screenshot | transparency and edges |
| test-photo-3.webp | WebP | modern format | direct reference, no variants |
| test-photo-4.jpg | JPG | illustration | lazy-load placeholder |
| test-photo-5-large.jpg | large JPG | stress asset | variants and decoding |

## Gallery

![Test photo 1: landscape composition](/media/test-photo-1.jpg "Figure 1: click to open the lightbox, arrow keys navigate")

![Test photo 2: UI screenshot](/media/test-photo-2.png "Figure 2: check PNG transparency edges and rounding")

![Test photo 3: WebP asset](/media/test-photo-3.webp "Figure 3: modern format referenced directly")

![Test photo 4: illustration](/media/test-photo-4.jpg "Figure 4: verify lazy loading and reserved dimensions")

![Test photo 5: large stress asset](/media/test-photo-5-large.jpg "Figure 5: large-image variants and async decoding")

## Lightbox Interaction

- Click any image to open the lightbox; press `Esc` to close;
- Navigate previous / next from inside the lightbox;
- On close, focus returns to the triggering image (keyboard accessible).

## Pipeline Notes

The build generates multiple widths plus WebP/AVIF variants for every bitmap, and emits them via `<picture>`:

```html
<picture>
  <source srcset="/media/variants/test-photo-1-640.webp 640w" type="image/webp">
  <img src="/media/test-photo-1.jpg" alt="Test photo 1" loading="lazy" decoding="async">
</picture>
```

> If an image is missing from the gallery, first check that the file exists under `media/` and that the filename casing matches.

Further reading: the image-heavy sections in [Long Article Stress Test](/en/long-stress/); [Welcome & Site Map](/en/hello-world/).
