---
title: Related Posts Test
slug: related-posts
tags: ["test", "build", "performance"]
categories: ["tech"]
description: "Shares multiple tags with hello-world, verifying the related recommendation scoring and ordering"
date: 2026-06-20 16:00
---

# Related Posts Test

This article shares the `test` and `build` tags with `hello-world` and the `performance` tag with `long-form-stress`, verifying the "related recommendations" scoring at the bottom of article pages (same tag 3 points / same category 2 points, Top 4).

## Expected Ordering

On this article's detail page, `hello-world` (shared 2 tags + 1 category = 8 points) should rank ahead of `long-form-stress` (shared 1 tag + 1 category = 5 points).

## Notes

- Related recommendation scores depend on the total article count; re-check ordering after adding new test articles
- The section does not display when no matching articles exist
