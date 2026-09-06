---
title: Pinned Post Test
slug: pinned-check
date: 2026-02-14 10:00
tags: [test]
categories: [tutorial]
pinned: true
---

# Pinned Post Test

This article sets `pinned: true` to verify the pinning mechanism.

Expected behavior:

- On the homepage, category pages, tag pages, and archive pages, this article should be ranked at the very top of each list, with a "Pinned" badge next to the title.
- Published-time articles should come after pinned ones (even if dated later).
- The badge uses the brand-color background with white text; a corresponding adaptation exists for dark mode.
