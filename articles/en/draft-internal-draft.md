---
title: Draft Test (Not Published)
slug: draft-internal-draft
tags: ["test"]
categories: ["internal"]
description: "Articles with draft:true are filtered out in normal builds and only shown with --drafts or --watch"
date: 2026-08-28 09:00
draft: true
---

# Draft Test

This article is marked `draft: true`. In a normal `npm run build` it should not appear on the homepage, in the archive, in the search index, in RSS, or in the sitemap.

It is only visible with `npm run dev` (or internally with `--drafts`). This is the regression test spot for the draft mechanism.

## Checkpoints

- Normal build → this page does not exist in dist/
- Dev mode → this page exists
- RSS does not include it (normal build)
- Search index does not include it (normal build)
