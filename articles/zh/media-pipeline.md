---
title: 本地图片管线测试
slug: media-pipeline
tags: ["图片", "优化", "WebP", "响应式"]
categories: ["技术", "教程"]
description: "验证 sharp 0.35 媒体优化管线:WebP 转换、多尺寸响应式 <picture>、懒加载与缓存破坏"
date: 2026-08-15 14:00
featuredImage: "/media/test-photo-1.jpg"
---

# 本地图片管线测试

本文引用 `media/` 目录下的五张程序化生成图片,验证构建时的媒体优化管线:sharp 转换、WebP 变体、多尺寸 srcset、懒加载与图片缓存破坏。

## 响应式图片 1（JPG 源，大图）

![测试图片 1 - JPG 大图](/media/test-photo-1.jpg)

## 透明 PNG（Alpha 通道）

![测试图片 2 - 透明 PNG](/media/test-photo-2.png)

## 原生 WebP 源

![测试图片 3 - WebP 源](/media/test-photo-3.webp)

## 小尺寸 JPG

![测试图片 4 - 小图](/media/test-photo-4.jpg)

## 超大图（3200×2000，触发 1920 断点）

![测试图片 5 - 超大图](/media/test-photo-5-large.jpg)

## 预期表现

- 每张图生成 `<picture>` 结构,含 WebP source(s)
- `media-manifest.json` 记录 640/1024/1920 尺寸变体
- 全部图片带 `loading="lazy"`（除非 lazyLoadImages 关闭）
- 转换后 dist/media/ 下出现 `.webp` 变体文件
- 缓存破坏后 HTML 引用带 MD5 哈希文件名
