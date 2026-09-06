---
title: Code Highlighting Multi-Language Coverage
slug: syntax-archive
tags: ["code", "highlight"]
categories: ["tech", "tutorial"]
description: "Covers code block rendering for PrismJS major languages with highlighting and line numbers"
date: 2026-03-05 12:00
---

# Code Highlighting Multi-Language Coverage

Covers the PrismJS theme rendering used by the build: HTML/JS/CSS, Python, Java, Go, Rust, SQL, Bash, JSON and diff blocks.

## HTML

```html
<article class="post">
  <h2>标题</h2>
  <p>正文示例,展示脚本转义</p>
</article>
```

## JavaScript

```javascript
const posts = ['hello-world', 'media-pipeline'];
posts.filter(p => p.includes('media'))
  .forEach(p => console.log(`found: ${p}`));
```

## Python

```python
import json

def load_manifest():
    with open("media-manifest.json", "r", encoding="utf-8") as f:
        return json.load(f)
```

## Java

```java
public record Post(String slug, List<String> tags) {
    public boolean hasTag(String tag) {
        return tags.contains(tag);
    }
}
```

## Go

```go
package main

func totalTags(posts []Post) int {
    n := 0
    for _, p := range posts {
        n += len(p.Tags)
    }
    return n
}
```

## Rust

```rust
fn slugify(input: &str) -> String {
    input
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_lowercase().to_string() } else { "-".into() })
        .collect()
}
```

## SQL

```sql
WITH ranked AS (
  SELECT category, COUNT(*) AS n
  FROM posts GROUP BY category
)
SELECT category, n FROM ranked ORDER BY n DESC LIMIT 5;
```

## Bash

```bash
#!/usr/bin/env bash
set -euo pipefail
npm ci && npm run build && npm test
```

## JSON

```json
{
  "site": { "title": "S-ynapse", "language": "zh-CN" },
  "build": { "minifyHtml": true, "cacheBusting": true }
}
```

## Diff

```diff
--- a/package.json
+++ b/package.json
@@ -12,3 +12,3 @@
-    "html-minifier": "4.0.0",
+    "@minify-html/node": "0.18.1",
```
