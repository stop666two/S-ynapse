---
title: 静态站点架构说明
slug: static-site-architecture
tags: ["架构", "构建链条"]
categories: ["技术", "随笔"]
description: "梳理 S-ynapse 构建管线与配置分层的整体架构,作为站点设计说明的示例文章"
date: 2026-03-18 19:00
---

# 静态站点架构说明

本文梳理项目整体分层:配置、模板、内容与产物,并解释构建管线如何把这些零件拼成静态站点。本文同时也是分页边界测试文章之一。

## 配置分层

配置按模块拆分:

| 文件 | 职责 |
|------|------|
| `site.json5` | 站点信息、SEO、RSS、构建开关矩阵 |
| `theme.json5` | 颜色、字体、布局与动效 |
| `navigation.json5` | 导航与搜索 |
| `sidebar.json5` | 侧栏组件 |
| `footer.json5` | 页脚列与版权 |
| `security.json5` | CSP 与安全头 |

## 构建管线

摘要:校验 → 合并配置 → 内容解析(marked + 自定义渲染器)→ 页面渲染(EJS)→ 产物优化(minify / cache-busting / 媒体 WebP)→ 生成 RSS、站点地图、搜索索引、安全头。

## 为什么保持静态

静态方案部署简单、无服务器开销,内容更新走 Git。代价是评论、搜索等动态能力需要外部服务,本仓库以 Giscus 与本地搜索索引兼顾二者。
