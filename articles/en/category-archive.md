---
title: Multi-Category & Archive Linkage
slug: category-archive
tags: ["category", "archive"]
categories: ["tech", "life", "essay"]
description: "An article that belongs to multiple categories at once, verifying the linkage between category pages, archive pages and breadcrumbs"
date: 2026-07-01 09:30
---

# Multi-Category & Archive Linkage

This article declares three categories at once: `技术`, `生活` and `随笔`. Expected behavior: all three category pages list this article, the archive view shows it only once, and tag cloud counts are correct.

## Category Page Behavior

- `/categories/技术/` contains this article
- `/categories/生活/` contains this article
- `/categories/随笔/` contains this article
- The category list page shows counts for all 3 categories

## Archive Behavior

- The July 2026 archive contains this article
- RSS and the sitemap contain this article
