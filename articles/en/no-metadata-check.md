---
title: No-Metadata Article
slug: no-metadata-check
date: 2026-07-25 08:30
---

# No-Metadata Article

This article deliberately omits the tags, categories and description fields, verifying the fallback logic: the title is taken from the filename, the description is auto-generated, and no page errors occur when tags/categories are empty lists.

## Fallback Behavior

- tags as an empty array → the tag cloud and the article tag section do not show
- categories as an empty array → this entry does not appear on category pages
- description omitted → the site description is used
- anchor links and prev/next links still work
