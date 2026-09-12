---
title: Site Building Notes (1) · Topics & Structure
slug: series-1
date: 2026-07-05 08:00:00
series: Site Building Notes
tags: [series, writing, test]
categories: [essay]
description: Part one of the series — choosing sections, content structure and the launch checklist.
---

# Site Building Notes (1) · Topics & Structure

This is part one of the "Site Building Notes" series (earliest date). A series navigation panel should appear below, showing 3 parts total, current part 1, with a "next" link.

## Structure First, Content Second

What keeps a site alive is not inspiration but sections. I keep exactly four:

1. **Essays** — methodology worth keeping;
2. **Notes** — records of problems solved;
3. **Series** — topics that need reading in order;
4. **About** — site info and contact.

> Define the structure first so "what to write next" never blocks you.

## Launch Checklist

| Order | Article | Purpose |
| --- | --- | --- |
| 1 | Welcome page | site navigation |
| 2 | Diagrams & math | rendering capabilities |
| 3 | Code showcase | typography details |

## Managing Drafts With a Little Code

```bash
git switch -c draft/series-1
git add articles/en/series-1.md
git commit -m "feat: series part one"
```

Next: [Site Building Notes (2)](/en/series-2/). Back to the hub: [Welcome & Site Map](/en/hello-world/).
