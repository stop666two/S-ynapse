---
title: English Only Content Check
slug: english-only-check
tags: ["i18n"]
categories: ["技术"]
description: "Pure English article verifying non-CJK rendering, date formats and latin typography"
date: 2026-08-20 10:00
---

# English Only Content Check

This article is deliberately written without CJK characters to verify the Latin rendering path: font fallback, date formatting and whitespace handling.

## Feature Checklist

- Date in frontmatter renders with the configured date format
- No thin-space insertion between characters
- External link target and rel attributes still apply

### Code Sample

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

Visit the [repository](https://github.com/stop666two/S-ynapse) for details.
