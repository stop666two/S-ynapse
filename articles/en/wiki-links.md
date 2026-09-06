---
title: Wiki Links Test
slug: wiki-links
date: 2026-08-23 11:00:00
tags: [javascript, test]
categories: [tech]
---

# Wiki Links Test

This article verifies the parsing behavior of `[[wiki syntax]]`, including cross-references between in-site articles, references by slug, external links, and unknown targets.

## In-Site Article References

Link to a published article title: [[hello-world]] should turn into a link to the hello-world article. Title matching is case-insensitive: [[HELLO-WORLD]] hits the same article.

## References by Slug

In-site slugs are also referenceable: [[static-site-architecture]] points to the article with that slug.

## Custom Display Text

The display text can be customized: [[hello-world|this link displays custom text]].

## External Links

Anonymous external URL links: [[https://developer.mozilla.org/|MDN]] and [[https://developer.mozilla.org/]] should generate external links.

## Unknown Targets

A nonexistent target: [[nonexistent-article-title]] falls back to plain text, producing no link and no error.

## Backlink Notes

The current version only implements one-way forward links; title and slug mappings are pre-generated at build time after scanning all articles.
