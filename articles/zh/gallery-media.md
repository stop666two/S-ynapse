---
title: 媒体画廊与图片管线
slug: gallery-media
date: 2026-09-02 16:20:00
tags: [图片, 媒体, 测试]
categories: [技术]
description: 五种图片格式（JPG/PNG/WebP/大尺寸 JPG）在页面中的渲染、懒加载、灯箱放大与媒体管线变体验收。
featuredImage: /media/test-photo-2.png
---

# 媒体画廊与图片管线

本文把 `media/` 目录下的全部素材排成画廊，逐张检查：**缩放与圆角**、**懒加载属性**、**点击灯箱**、**图注对齐**，以及构建期生成的 **WebP/AVIF 变体**是否被 `<picture>` 正确引用。

## 素材一览

| 文件 | 格式 | 用途 | 验收点 |
| --- | --- | --- | --- |
| test-photo-1.jpg | JPG | 横版照片 | 基础渲染与灯箱 |
| test-photo-2.png | PNG | 界面截图 | 透明通道与边缘 |
| test-photo-3.webp | WebP | 现代格式 | 直接引用免变体 |
| test-photo-4.jpg | JPG | 配图 | 懒加载占位 |
| test-photo-5-large.jpg | 大图 JPG | 压力素材 | 变体与解码 |

## 画廊

![测试照片 1：横版构图](/media/test-photo-1.jpg "图 1：点击打开灯箱，左右方向键切换")

![测试照片 2：界面截图](/media/test-photo-2.png "图 2：检查 PNG 透明边缘与圆角")

![测试照片 3：WebP 素材](/media/test-photo-3.webp "图 3：现代格式直接引用")

![测试照片 4：配图示例](/media/test-photo-4.jpg "图 4：验证懒加载与占位尺寸")

![测试照片 5：大尺寸压力素材](/media/test-photo-5-large.jpg "图 5：大图变体与异步解码")

## 灯箱交互

- 点击任意图片打开灯箱，`Esc` 关闭；
- 灯箱内左右切换上一张 / 下一张；
- 关闭后焦点回到触发图片（键盘可达性）。

## 管线说明

构建期会为每张位图生成多档宽度与 WebP/AVIF 变体，并在正文里用 `<picture>` 输出：

```html
<picture>
  <source srcset="/media/variants/test-photo-1-640.webp 640w" type="image/webp">
  <img src="/media/test-photo-1.jpg" alt="测试照片 1" loading="lazy" decoding="async">
</picture>
```

> 如果某张图未出现在画廊，先检查 `media/` 下文件是否存在、文件名大小写是否一致。

延伸阅读：[长文压力测试](/zh/long-stress/) 中的图片密集章节；[欢迎与全站导航](/zh/hello-world/)。
