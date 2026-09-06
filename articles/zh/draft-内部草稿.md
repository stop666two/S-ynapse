---
title: 草稿测试（不会被发布）
slug: draft-内部草稿
tags: ["测试"]
categories: ["内部"]
description: "draft:true 的文章在正常构建中应被过滤,仅 --drafts 或 --watch 时显示"
date: 2026-08-28 09:00
draft: true
---

# 草稿测试

这是一篇标记为 `draft: true` 的文章。正常 `npm run build` 时不应出现在首页、归档、搜索索引、RSS 或站点地图中。

使用 `npm run dev`(或其内部 `--drafts`)时才可见。这是草稿机制的回归测试位。

## 检查点

- 正常构建 → 本页不存在于 dist/
- dev 模式 → 本页存在
- RSS 不包含(正常构建)
- 搜索索引不包含(正常构建)
