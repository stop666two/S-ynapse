---
title: Static Site Architecture Overview
slug: static-site-architecture
tags: ["architecture", "build-pipeline"]
categories: ["tech", "essay"]
description: "Maps the overall architecture of the S-ynapse build pipeline and configuration layering, as an example article for the site design docs"
date: 2026-03-18 19:00
---

# Static Site Architecture Overview

This article maps the project's overall layering: configuration, templates, content, and output — and explains how the build pipeline assembles these parts into a static site. It is also one of the pagination boundary-test articles.

## Configuration Layering

Configuration is split by module:

| File | Responsibility |
|------|------|
| `site.json5` | Site info, SEO, RSS, build switch matrix |
| `theme.json5` | Colors, fonts, layout and motion |
| `navigation.json5` | Navigation and search |
| `sidebar.json5` | Sidebar widgets |
| `footer.json5` | Footer columns and copyright |
| `security.json5` | CSP and security headers |

## Build Pipeline

Summary: validate → merge configs → parse content (marked + custom renderers) → render pages (EJS) → optimize output (minify / cache-busting / WebP media) → generate RSS, sitemap, search index, security headers.

## Why Stay Static

The static approach is simple to deploy, has no server overhead, and content updates go through Git. The tradeoff is that dynamic capabilities like comments and search require external services; this repo uses Giscus and a local search index to cover both.
