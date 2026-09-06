---
title: Tables, Blockquotes & Nested Structures
slug: tables-and-nesting
tags: ["syntax", "markdown"]
categories: ["tutorial"]
description: "Comprehensive test of complex tables, blockquote nesting, mixed lists and code block language labels"
date: 2026-05-15 13:00
---

# Tables, Blockquotes & Nested Structures

Aggregation-tests the boundaries of Markdown rendering: merged-cell-style tables, lists inside blockquotes, code inside lists, task lists.

## Mixed Table

| Feature | Support | Notes |
|------|------|------|
| Tables | ✅ | GFM table alignment |
| Task lists | ✅ | `- [x]` syntax |
| Strikethrough | ✅ | `~~text~~` |
| Superscript/subscript | ✅ | `sup` / `sub` tags |

## Nested Blockquotes & Lists

> Blockquotes can contain lists:
> 1. First list item
> 2. Second list item
>
> Body text after the blockquote continues rendering.
> A blockquote inside a blockquote:
>
> > Second-level quote — should remain a blockquote with correct indentation.

## Code Block Language Labels

```diff
- from: html-minifier
+ to: @minify-html/node
```

```bash
npm run build
npm run verify:security
```

## Task Lists

- [x] Write test article
- [x] Verify table rendering
- [ ] Verify pagination (handled by the homepage with 11 articles)
