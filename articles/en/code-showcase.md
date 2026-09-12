---
title: Code Blocks Showcase
slug: code-showcase
date: 2026-08-02 14:00:00
tags: [js, ts, code, test]
categories: [tech]
description: "Rendering acceptance across 12 languages: line numbers, language pills, terminal prompts, diff coloring, long-line horizontal scroll, copy and download."
featuredImage: /media/test-photo-3.webp
---

# Code Blocks Showcase

This page covers every code-block rendering mode: line numbers, language pills, terminal prompt prefixes (bash/powershell/console), diff insert/delete coloring, long-line horizontal scrolling, plain text blocks, and copy/download buttons.

## JavaScript

```js
const cache = new Map();
export async function loadConfig(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}
```

## TypeScript

```ts
interface Article {
  slug: string;
  title: string;
  tags: string[];
  date: Date;
}

function sortByDate(list: Article[]): Article[] {
  return [...list].sort((a, b) => b.date.getTime() - a.date.getTime());
}
```

## Python

```python
from dataclasses import dataclass

@dataclass
class Post:
    slug: str
    words: int

def total_words(posts: list[Post]) -> int:
    return sum(p.words for p in posts)

if __name__ == "__main__":
    print(total_words([Post("a", 120), Post("b", 300)]))
```

## Bash (terminal prompt)

```bash
npm run build
node scripts/security-verify.js
rg -n "TODO" articles/ | wc -l
```

## PowerShell (terminal prompt)

```powershell
Get-ChildItem articles/en -Filter *.md | Measure-Object
node .tmp-scripts/run-build.js
```

## JSON5

```json5
// Site snippet (comments and trailing commas allowed)
{
  site: {
    title: "S-ynapse",
    lang: "en",
    performance: { imageDecoding: "async", lazyLoad: true },
  },
}
```

## YAML

```yaml
deploy:
  target: cloudflare
  pages:
    prod: https://example.com
  steps:
    - build
    - verify
    - upload
```

## SQL

```sql
SELECT tag, COUNT(*) AS posts
FROM article_tags
WHERE published = 1
GROUP BY tag
ORDER BY posts DESC
LIMIT 10;
```

## Diff (insert/delete coloring)

```diff
- const timeout = 3000;
+ const timeout = 5000;
  function retry(fn, times) {
-   for (let i = 0; i < times; i++) fn();
+   for (let i = 0; i < times; i++) {
+     try { return fn(); } catch (e) { /* keep retrying */ }
+   }
  }
```

## HTML

```html
<picture>
  <source srcset="/media/test-photo-1.webp" type="image/webp">
  <img src="/media/test-photo-1.jpg" alt="sample" loading="lazy" decoding="async">
</picture>
```

## CSS

```css
.post-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

## Markdown

```markdown
## Heading

- **Key point**: inline code `npm run build`
- [Link](https://example.com)
```

## Long Line (horizontal scroll)

```js
const veryLongLine = "A deliberately long string to verify that overflowing code blocks provide horizontal scrolling instead of breaking the page layout; abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz";
```

## Plain Text (no language)

```text
A plain fenced block should still get line numbers and no language label.
Second line: verify number alignment.
Third line: verify the monospace font.
```

> The copy button writes the block to your clipboard and plays a stroke animation; the download button exports it as a text file with the matching extension.

More interaction paths in [Welcome & Site Map](/en/hello-world/) and [Diagrams & Math](/en/diagrams-math/).
